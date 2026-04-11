import axios from 'axios'

const BASE_URL = 'https://api.msg91.com/api/v5'

export async function sendOtp(mobile: string, otp: string) {
  const response = await axios.post(`${BASE_URL}/otp`, null, {
    params: {
      authkey: process.env.MSG91_API_KEY,
      template_id: process.env.MSG91_OTP_TEMPLATE_ID,
      mobile: `91${mobile}`,
      otp,
    },
  })
  return response.data
}

export async function sendSms(mobile: string, message: string) {
  const response = await axios.post(`${BASE_URL}/flow/`, {
    flow_id: process.env.MSG91_FLOW_ID,
    sender: process.env.MSG91_SENDER_ID,
    mobiles: `91${mobile}`,
    body: message,
  }, {
    headers: { authkey: process.env.MSG91_API_KEY, 'content-type': 'application/json' },
  })
  return response.data
}
