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

async function sendPasswordChangedEmail(to) {
  await transporter.sendMail({
    from: `"Locagain" <${process.env.MAIL_FROM}>`,
    to,
    subject: 'Votre mot de passe a été modifié',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <h2 style="color:#1A1A23;font-size:20px;margin:0 0 8px;">Mot de passe modifié</h2>
        <p style="color:#6B6B78;font-size:14px;margin:0 0 24px;">
          Votre mot de passe Locagain a été modifié avec succès.<br><br>
          Si vous n'êtes pas à l'origine de ce changement, réinitialisez immédiatement
          votre mot de passe et contactez notre support.
        </p>
        <p style="color:#9B9BA8;font-size:12px;margin:24px 0 0;">
          Cet email est envoyé automatiquement suite à un changement de mot de passe sur votre compte.
        </p>
      </div>
    `,
  })
}

async function sendInvitationEmail({ to, firstname, businessName, collectUrl }) {
  await transporter.sendMail({
    from: `"${businessName}" <${process.env.MAIL_FROM}>`,
    to,
    subject: `${businessName} — Votre avis compte pour nous`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <h2 style="color:#1A1A23;font-size:20px;margin:0 0 8px;">Votre avis nous intéresse</h2>
        <p style="color:#6B6B78;font-size:14px;margin:0 0 24px;">
          ${firstname ? `Bonjour ${firstname},<br><br>` : ''}
          L'équipe de <strong>${businessName}</strong> aimerait connaître votre expérience.<br>
          Cela prend moins d'une minute.
        </p>
        <a href="${collectUrl}"
           style="display:inline-block;background:#7C5CFC;color:#fff;font-size:14px;font-weight:600;
                  padding:12px 28px;border-radius:8px;text-decoration:none;">
          Donner mon avis
        </a>
        <p style="color:#9B9BA8;font-size:12px;margin:24px 0 0;">
          Vous recevez ce message car vous êtes client de ${businessName}.<br>
          Si vous ne souhaitez plus recevoir nos emails, contactez-nous.
        </p>
      </div>
    `,
  })
}

const ROLE_LABELS = { admin: 'Administrateur', editor: 'Éditeur', viewer: 'Lecteur' }

async function sendTeamInviteEmail({ to, businessName, role, acceptUrl, isExistingUser }) {
  await transporter.sendMail({
    from: `"Locagain" <${process.env.MAIL_FROM}>`,
    to,
    subject: `Invitation à rejoindre ${businessName} sur Locagain`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <h2 style="color:#1A1A23;font-size:20px;margin:0 0 8px;">Vous êtes invité·e</h2>
        <p style="color:#6B6B78;font-size:14px;margin:0 0 24px;">
          Vous avez été invité·e à rejoindre l'équipe de <strong>${businessName}</strong> sur Locagain
          en tant que <strong>${ROLE_LABELS[role] || role}</strong>.<br><br>
          ${isExistingUser
            ? 'Connectez-vous avec votre compte existant pour accepter cette invitation.'
            : 'Cliquez ci-dessous pour créer votre compte et rejoindre l\'équipe.'}
        </p>
        <a href="${acceptUrl}"
           style="display:inline-block;background:#7C5CFC;color:#fff;font-size:14px;font-weight:600;
                  padding:12px 28px;border-radius:8px;text-decoration:none;">
          Accepter l'invitation
        </a>
        <p style="color:#9B9BA8;font-size:12px;margin:24px 0 0;">
          Ce lien est valable 7 jours. Si vous n'attendiez pas cette invitation, ignorez cet email.
        </p>
      </div>
    `,
  })
}

module.exports = { sendResetEmail, sendPasswordChangedEmail, sendInvitationEmail, sendTeamInviteEmail }
