// Firebase Admin SDK for push notifications
// npm install firebase-admin

let admin: any = null

export function getFirebaseAdmin() {
  if (!admin && process.env.FIREBASE_SERVICE_ACCOUNT) {
    const firebaseAdmin = require('firebase-admin')
    if (!firebaseAdmin.apps.length) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(
          JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        ),
      })
    }
    admin = firebaseAdmin
  }
  return admin
}

export async function sendPushNotification(token: string, title: string, body: string) {
  const fb = getFirebaseAdmin()
  if (!fb) return null
  return fb.messaging().send({ token, notification: { title, body } })
}
