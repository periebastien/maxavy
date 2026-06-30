const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS,
  },
})

async function sendResetEmail(to, resetUrl) {
  await transporter.sendMail({
    from: `"Locagain" <${process.env.MAIL_FROM}>`,
    to,
    subject: 'Réinitialisation de votre mot de passe',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <h2 style="color:#1A1A23;font-size:20px;margin:0 0 8px;">Réinitialisation du mot de passe</h2>
        <p style="color:#6B6B78;font-size:14px;margin:0 0 24px;">
          Vous avez demandé à réinitialiser votre mot de passe Locagain.<br>
          Ce lien est valable <strong>1 heure</strong>.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#7C5CFC;color:#fff;font-size:14px;font-weight:600;
                  padding:10px 24px;border-radius:8px;text-decoration:none;">
          Réinitialiser mon mot de passe
        </a>
        <p style="color:#9B9BA8;font-size:12px;margin:24px 0 0;">
          Si vous n'avez pas fait cette demande, ignorez cet email.<br>
          Votre mot de passe ne sera pas modifié.
        </p>
      </div>
    `,
  })
}

module.exports = { sendResetEmail }
