// Configure RESEND_API_KEY and EMAIL_FROM to send real reset emails.
// Without those settings, the app stays usable locally and returns a test link.
export async function sendPasswordResetEmail({ to, resetUrl }) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.log(`Development password reset link for ${to}: ${resetUrl}`);
    return { delivered: false, developmentUrl: resetUrl };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject: 'Reset your InClaim password',
      html: `<p>We received a request to reset your InClaim password.</p><p><a href="${resetUrl}">Create a new password</a></p><p>This link expires in one hour. If you did not request it, you can ignore this email.</p>`
    })
  });
  if (!response.ok) throw new Error('Unable to send password reset email. Check your email configuration.');
  return { delivered: true };
}
