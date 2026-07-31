import test from "node:test";
import assert from "node:assert/strict";

import { buildSearchQuery, searchWindow, requiresAttachment } from "./gmail.js";

/** Run `fn` with GMAIL_* env vars replaced, then restore whatever was there. */
function withEnv(vars, fn) {
  const keys = [
    "GMAIL_SEARCH_WINDOW",
    "GMAIL_SEARCH_LABEL",
    "GMAIL_SUBJECT_FILTER",
    "GMAIL_REQUIRE_ATTACHMENT",
  ];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  for (const key of keys) delete process.env[key];
  Object.assign(process.env, vars);

  try {
    return fn();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test("the search window defaults to 30 days when unconfigured", () => {
  withEnv({}, () => {
    assert.equal(searchWindow(), "30d");
    assert.match(buildSearchQuery(), /newer_than:30d/);
  });
});

test("a configured window is used verbatim, in days, months or years", () => {
  for (const value of ["90d", "6m", "1y"]) {
    withEnv({ GMAIL_SEARCH_WINDOW: value }, () => {
      assert.equal(searchWindow(), value);
      assert.match(buildSearchQuery(), new RegExp(`newer_than:${value}`));
    });
  }
});

test("surrounding whitespace and capitals are tolerated", () => {
  withEnv({ GMAIL_SEARCH_WINDOW: "  90D  " }, () => {
    assert.equal(searchWindow(), "90d");
  });
});

test("a malformed window falls back rather than breaking the whole query", () => {
  // Gmail rejects the entire query on a bad newer_than:, which would show the
  // operator an empty picker with no explanation.
  for (const value of ["30 days", "d30", "0d", "-5d", "1w", "soon"]) {
    withEnv({ GMAIL_SEARCH_WINDOW: value }, () => {
      assert.equal(searchWindow(), "30d", `expected fallback for "${value}"`);
    });
  }
});

test("an empty window is treated as unset", () => {
  withEnv({ GMAIL_SEARCH_WINDOW: "   " }, () => {
    assert.equal(searchWindow(), "30d");
  });
});

test("drafts are excluded — an unsent reply is not a client nomination", () => {
  withEnv({}, () => {
    assert.match(buildSearchQuery(), /-in:drafts/);
  });
});

test("a subject match alone is enough — an attachment is not required", () => {
  withEnv({ GMAIL_SUBJECT_FILTER: "STS" }, () => {
    const query = buildSearchQuery();

    assert.equal(requiresAttachment(), false);
    assert.doesNotMatch(query, /has:attachment/, "subject alone decides what is importable");
    assert.match(query, /subject:\("STS"\)/);
  });
});

test("GMAIL_REQUIRE_ATTACHMENT restores the attachments-only picker", () => {
  for (const value of ["true", "TRUE", "1", "yes", "on"]) {
    withEnv({ GMAIL_SUBJECT_FILTER: "STS", GMAIL_REQUIRE_ATTACHMENT: value }, () => {
      assert.equal(requiresAttachment(), true, `expected "${value}" to enable it`);
      assert.match(buildSearchQuery(), /has:attachment/);
    });
  }
});

test("anything else leaves the requirement off", () => {
  for (const value of ["", "false", "no", "0", "off", "maybe"]) {
    withEnv({ GMAIL_SUBJECT_FILTER: "STS", GMAIL_REQUIRE_ATTACHMENT: value }, () => {
      assert.equal(requiresAttachment(), false, `expected "${value}" to leave it off`);
    });
  }
});

test("with nothing else narrowing it, the attachment clause is the backstop", () => {
  // Otherwise the picker would list every recent message in the mailbox.
  withEnv({}, () => {
    assert.match(buildSearchQuery(), /has:attachment/);
  });

  // A label or a sender narrows it just as well as a subject filter does.
  withEnv({ GMAIL_SEARCH_LABEL: "Clients/Nominations" }, () => {
    assert.doesNotMatch(buildSearchQuery(), /has:attachment/);
  });
  withEnv({}, () => {
    assert.doesNotMatch(buildSearchQuery({ from: "ops@client.com" }), /has:attachment/);
  });
});

test("the window does not disturb the other scoping clauses", () => {
  withEnv(
    {
      GMAIL_SEARCH_WINDOW: "6m",
      GMAIL_SUBJECT_FILTER: "STS,nomination",
      GMAIL_REQUIRE_ATTACHMENT: "true",
    },
    () => {
      const query = buildSearchQuery({ from: "ops@client.com" });

      assert.match(query, /has:attachment/);
      assert.match(query, /newer_than:6m/);
      assert.match(query, /subject:\("STS" OR "nomination"\)/);
      assert.match(query, /from:"ops@client\.com"/);
    }
  );
});
