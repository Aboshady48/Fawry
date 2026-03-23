const nodemailer = require("nodemailer");

exports.sendResetTokenEmail = async (toEmail, rawToken) => {

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // ✅ Send a link instead of a raw token
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

  const mailOptions = {
    from: `"Fawry Support" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Password Reset Request",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
        <h2 style="color: #4CAF50;">Password Reset Request</h2>
        <p>You requested to reset your password. Click the button below:</p>
        
        <a href="${resetLink}" 
           style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; 
                  color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Reset My Password
        </a>

        <p>This link expires in <strong>15 minutes</strong>.</p>
        <p>If you didn't request this, ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};