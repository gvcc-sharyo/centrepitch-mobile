const formatPhoneForE164 = (phone = "", defaultCountryCode = "91") => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith(defaultCountryCode)) return `+${digits}`;
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  return `+${digits}`;
};

const sendViaTwilio = async ({ phone, otp }) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) {
    throw new Error("Twilio is not configured");
  }

  const to = formatPhoneForE164(phone, process.env.DEFAULT_COUNTRY_CODE || "91");
  const body = `Your Centre-Pitch verification code is ${otp}. It expires in 10 minutes.`;
  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Twilio send failed: ${response.status} ${errText}`);
  }
};

const sendPhoneOtp = async ({ phone, otp }) => {
  const provider = String(process.env.SMS_PROVIDER || "twilio").toLowerCase();

  try {
    if (provider === "twilio") {
      await sendViaTwilio({ phone, otp });
      return { success: true };
    }

    throw new Error(`Unsupported SMS provider: ${provider}`);
  } catch (error) {
    // Developer fallback to avoid blocking local development.
    if (String(process.env.NODE_ENV || "").toLowerCase() !== "production") {
      console.warn(`[DEV OTP] Phone: ${phone}, OTP: ${otp}`);
      return { success: true, isDevFallback: true };
    }
    return { success: false, error: error.message };
  }
};

export default sendPhoneOtp;
