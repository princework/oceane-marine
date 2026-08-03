require("dotenv").config({ path: ".env.local", quiet: true });
const mongoose = require("mongoose");

const users = [
  {
    _id: new mongoose.Types.ObjectId("69ccc239ed3cbad63e88f056"),
    employeeId: "OMT-003",
    employeeName: "Randhir-Fujbase",
    email: "fujbase@oceanemarine.com",
    password: "$2b$10$1RLx3GzbYQ/Ss7p3fVfP6egeed/hhrpm5uug6BqA07Ss9HVOol2Xe",
    roles: ["EDITOR"],
    operationsRole: "editor",
    isActive: true,
    createdAt: new Date("2026-04-01T06:59:05.567+00:00"),
    updatedAt: new Date("2026-04-02T12:49:35.707+00:00"),
    hrRole: "editor",
    pmsRole: "editor",
    qhseRole: "editor",
  },
  {
    _id: new mongoose.Types.ObjectId("69ccc239ed3cbad63e88f057"),
    employeeId: "OMT-001",
    employeeName: "Capt Beant Singh",
    email: "captbeantsingh@oceanemarine.com",
    password: "$2b$10$1RLx3GzbYQ/Ss7p3fVfP6egeed/hhrpm5uug6BqA07Ss9HVOol2Xe",
    roles: ["EDITOR"],
    operationsRole: "editor",
    isActive: true,
    createdAt: new Date("2026-04-01T06:59:05.567+00:00"),
    updatedAt: new Date("2026-04-02T12:45:05.766+00:00"),
    hrRole: "editor",
    pmsRole: "editor",
    qhseRole: "editor",
  },
  {
    _id: new mongoose.Types.ObjectId("69ccc239ed3cbad63e88f058"),
    employeeId: "OFD-002",
    employeeName: "Capt Jagdeep Singh Sodhi",
    email: "captjagdeepsingh.sodhi@oceanemarine.com",
    password: "$2b$10$1RLx3GzbYQ/Ss7p3fVfP6egeed/hhrpm5uug6BqA07Ss9HVOol2Xe",
    roles: ["REVIEWER"],
    operationsRole: "approver",
    isActive: true,
    createdAt: new Date("2026-04-01T06:59:05.567+00:00"),
    updatedAt: new Date("2026-04-02T12:42:58.530+00:00"),
    hrRole: "approver",
    pmsRole: "approver",
    qhseRole: "approver",
  },
  {
    _id: new mongoose.Types.ObjectId("69ccc239ed3cbad63e88f059"),
    employeeId: "OFD-001",
    employeeName: "Sunil Kurup",
    email: "sunil.kurup@oceanemarine.com",
    password: "$2b$10$1RLx3GzbYQ/Ss7p3fVfP6egeed/hhrpm5uug6BqA07Ss9HVOol2Xe",
    roles: ["REVIEWER"],
    operationsRole: "approver",
    isActive: true,
    createdAt: new Date("2026-04-01T06:59:05.567+00:00"),
    updatedAt: new Date("2026-04-02T12:42:32.245+00:00"),
    hrRole: "approver",
    pmsRole: "approver",
    qhseRole: "approver",
  },
];

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    const col = mongoose.connection.collection("users");
    const res = await col.insertMany(users);
    console.log("Inserted:", res.insertedCount);
    const count = await col.countDocuments({});
    console.log("Total users now:", count);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
