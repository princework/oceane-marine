"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { getFormConfig, QHSE_FIXED_FORM_CODES } from "@/lib/qhseFormConfig";

const SECTIONS = [
  {
    key: "location",
    title: "1. Location Information",
    fields: [
      { name: "locationName", label: "Transfer Location Name", required: true },
      { name: "latitude", label: "Latitude" },
      { name: "longitude", label: "Longitude" },
      { name: "country", label: "Country" },
      { name: "portOrOffshoreArea", label: "Port / Offshore Area" },
      { name: "waterDepth", label: "Water Depth" },
    ],
  },
  {
    key: "environmental",
    title: "2. Environmental Conditions",
    fields: [
      { name: "weatherConditions", label: "Weather Conditions" },
      { name: "windLimits", label: "Wind Limits" },
      { name: "waveHeight", label: "Wave Height" },
      { name: "currentSpeed", label: "Current Speed" },
      { name: "tidalInformation", label: "Tidal Information" },
    ],
  },
  {
    key: "traffic",
    title: "3. Traffic Information",
    fields: [
      { name: "nearbyShippingLanes", label: "Nearby Shipping Lanes" },
      { name: "anchorageDetails", label: "Anchorage Details" },
      { name: "trafficDensity", label: "Traffic Density" },
    ],
  },
  {
    key: "regulatory",
    title: "4. Regulatory Information",
    fields: [
      { name: "localAuthorityApproval", label: "Local Authority Approval" },
      { name: "portAuthorityRequirements", label: "Port Authority Requirements" },
      { name: "environmentalRestrictions", label: "Environmental Restrictions" },
    ],
  },
  {
    key: "emergencySupport",
    title: "5. Emergency Support",
    fields: [
      { name: "nearestTug", label: "Nearest Tug" },
      { name: "pilotAvailability", label: "Pilot Availability" },
      { name: "medicalAssistance", label: "Medical Assistance" },
      { name: "emergencyContacts", label: "Emergency Contacts" },
    ],
  },
  {
    key: "communication",
    title: "6. Communication",
    fields: [
      { name: "vhfChannels", label: "VHF Channels" },
      { name: "contactPersons", label: "Contact Persons" },
      { name: "communicationProcedures", label: "Communication Procedures" },
    ],
  },
  {
    key: "operationalRestrictions",
    title: "7. Operational Restrictions",
    fields: [
      { name: "dayNightOperationAllowed", label: "Day/Night Operation Allowed" },
      { name: "maximumVesselSize", label: "Maximum Vessel Size" },
      { name: "draftLimitations", label: "Draft Limitations" },
      { name: "mooringRestrictions", label: "Mooring Restrictions" },
    ],
  },
];

function emptySectionState() {
  const state = {};
  for (const section of SECTIONS) {
    state[section.key] = {};
    for (const field of section.fields) {
      state[section.key][field.name] = "";
    }
  }
  return state;
}

export default function TransferLocationQuestFormPage() {
  const config = getFormConfig("transfer-location-quest");
  const searchParams = useSearchParams();
  const operationRef = searchParams?.get("operationRef")?.trim() || "";

  const [sections, setSections] = useState(emptySectionState);
  const [submittedByName, setSubmittedByName] = useState("");
  const [submittedByEmail, setSubmittedByEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [serialNumber, setSerialNumber] = useState("");

  const updateField = (sectionKey, fieldName, value) => {
    setSections((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], [fieldName]: value },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    if (!sections.location.locationName.trim()) {
      setSubmitError("Transfer Location Name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = {
        operationRef,
        ...sections,
        submittedByName: submittedByName.trim(),
        submittedByEmail: submittedByEmail.trim(),
      };

      const createPath = config?.createPath || "qhse/form-checklist/transfer-location-quest/submit";
      const response = await fetch(`/api/proxy/${createPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      const responseText = await response.text();
      let result = {};
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(
          response.ok
            ? "Invalid response from server."
            : `Request failed (${response.status}). ${responseText.slice(0, 120)}`
        );
      }
      if (!response.ok) {
        const msg = result?.error || result?.message || `Server error: ${response.status}`;
        throw new Error(msg);
      }
      if (result.data?.serialNumber) setSerialNumber(result.data.serialNumber);
      setSubmitSuccess(
        result.data?.serialNumber
          ? `Questionnaire submitted successfully. Serial No: ${result.data.serialNumber}`
          : "Questionnaire submitted successfully."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(error.message || "Failed to submit questionnaire. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!operationRef) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-gray-800 border border-gray-700 rounded-2xl p-8">
          <h1 className="text-xl font-bold text-white mb-2">Link not recognized</h1>
          <p className="text-gray-300 text-sm">
            This form must be opened from the link emailed for a specific operation
            (missing operation reference). Please use the link provided in your email.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50 py-4 px-4 shadow-lg">
        <div className="container mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="rounded-lg">
              <Image
                src="/image/logo.png"
                alt="OCEANE GROUP Logo"
                width={120}
                height={60}
                className="object-contain"
              />
            </div>
          </Link>

          <div className="flex-1 flex justify-center">
            <h1 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-white text-center">
              Transfer Location Questionnaire
            </h1>
          </div>

          <div className="bg-gray-700 rounded-lg p-3 border border-gray-600 min-w-[250px] w-full md:w-auto">
            <div className="text-sm space-y-1 text-gray-300">
              <div className="flex justify-between gap-4">
                <span>Form Code:</span>
                <span className="text-white font-semibold">
                  {config?.formCode || QHSE_FIXED_FORM_CODES.STS_TRANSFER_LOCATION_QUEST}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Operation Ref:</span>
                <span className="text-white font-semibold">{operationRef}</span>
              </div>
              {serialNumber && (
                <div className="flex justify-between gap-4">
                  <span>Serial No:</span>
                  <span className="text-white font-semibold">{serialNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        {submitError && (
          <div className="mb-6 bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
            {submitError}
          </div>
        )}
        {submitSuccess && (
          <div className="mb-6 bg-green-950/40 border border-green-500/40 rounded-xl px-4 py-3 text-green-200 text-sm font-medium">
            {submitSuccess}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-gray-700 bg-gray-800/60 p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white border-b border-gray-700 pb-3">
              Your Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Your Name</label>
                <input
                  type="text"
                  value={submittedByName}
                  onChange={(e) => setSubmittedByName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-sky-500"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Your Email</label>
                <input
                  type="email"
                  value={submittedByEmail}
                  onChange={(e) => setSubmittedByEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-sky-500"
                  placeholder="Enter your email"
                />
              </div>
            </div>
          </section>

          {SECTIONS.map((section) => (
            <section
              key={section.key}
              className="rounded-2xl border border-gray-700 bg-gray-800/60 p-4 sm:p-6 space-y-4"
            >
              <h2 className="text-lg font-semibold text-white border-b border-gray-700 pb-3">
                {section.title}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      {field.label}
                      {field.required && <span className="text-red-400"> *</span>}
                    </label>
                    <input
                      type="text"
                      value={sections[section.key][field.name]}
                      onChange={(e) => updateField(section.key, field.name, e.target.value)}
                      required={field.required}
                      className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-sky-500"
                      placeholder={field.label}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-sky-500 hover:bg-sky-600 px-8 py-3 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Submitting..." : "Submit Questionnaire"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
