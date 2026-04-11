import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

export async function sendEmail(to: string, subject: string, html: string) {
  return sgMail.send({
    to,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL!,
      name: process.env.SENDGRID_FROM_NAME ?? 'Waterpark',
    },
    subject,
    html,
  })
}

export async function sendBookingConfirmation(to: string, bookingNumber: string, visitDate: string) {
  return sendEmail(
    to,
    `Booking Confirmed - ${bookingNumber}`,
    `<h1>Booking Confirmed!</h1><p>Your booking <strong>${bookingNumber}</strong> for <strong>${visitDate}</strong> is confirmed.</p>`
  )
}
