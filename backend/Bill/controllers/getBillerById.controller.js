const { pool } = require("../../config/db");

// What info each category needs to look up a bill
const INQUIRY_FIELDS = {
  electricity: [
    { field: "meter_number",  label: "Meter Number",   type: "number",  required: true  },
    { field: "national_id",   label: "National ID",    type: "number",  required: false },
  ],
  water: [
    { field: "account_number", label: "Account Number", type: "number", required: true  },
    { field: "national_id",    label: "National ID",    type: "number", required: false },
  ],
  gas: [
    { field: "meter_number",  label: "Meter Number",   type: "number",  required: true  },
  ],
  telecom: [
    { field: "phone_number",  label: "Phone Number",   type: "phone",   required: true  },
  ],
  internet: [
    { field: "account_number", label: "Account Number", type: "number", required: true  },
    { field: "phone_number",   label: "Phone Number",   type: "phone",  required: false },
  ],
  insurance: [
    { field: "policy_number", label: "Policy Number",  type: "text",    required: true  },
    { field: "national_id",   label: "National ID",    type: "number",  required: true  },
  ],
  education: [
    { field: "student_id",    label: "Student ID",     type: "number",  required: true  },
    { field: "national_id",   label: "National ID",    type: "number",  required: false },
  ],
  government: [
    { field: "national_id",   label: "National ID",    type: "number",  required: true  },
    { field: "file_number",   label: "File Number",    type: "number",  required: false },
  ],
  other: [
    { field: "account_number", label: "Account Number", type: "text",   required: true  },
  ],
};

exports.getBillerById = async (req, res) => {
  const { billerId } = req.params;

  // 1. Validate ID
  if (isNaN(billerId)) {
    return res.status(400).json({ message: "Invalid biller ID" });
  }

  try {
    // 2. Get biller
    const result = await pool.query(
      `SELECT
        b.id,
        b.name,
        b.category,
        b.logo_url,
        b.is_active
       FROM billers b
       WHERE b.id = $1
       LIMIT 1`,
      [billerId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Biller not found" });
    }

    const biller = result.rows[0];

    // 3. Check biller is active
    if (!biller.is_active) {
      return res.status(400).json({ message: "This biller is currently unavailable" });
    }

    // 4. Get inquiry fields for this category
    const inquiryFields = INQUIRY_FIELDS[biller.category] || INQUIRY_FIELDS.other;

    return res.status(200).json({
      id:             biller.id,
      name:           biller.name,
      category:       biller.category,
      logo_url:       biller.logo_url,
      inquiry_fields: inquiryFields,
      instructions:   `Please provide the required fields to look up your ${biller.name} bill`,
    });

  } catch (err) {
    console.error("getBillerById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};