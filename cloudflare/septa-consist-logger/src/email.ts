export interface EmailEnv {
  RESEND_API_KEY: string;
  NOTIFY_EMAIL: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function sendDailyExportEmail(
  env: EmailEnv,
  date: string,
  xlsxBytes: Uint8Array,
  tripCount: number
): Promise<void> {
  const content = toBase64(xlsxBytes);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SEPTA Consist Logger <onboarding@resend.dev>",
      to: [env.NOTIFY_EMAIL],
      subject: `SEPTA consists — ${date} (${tripCount} trips)`,
      text: `Attached: every train logged on ${date}, with car consists where observed.`,
      attachments: [
        {
          filename: `septa-consists-${date}.xlsx`,
          content,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend send failed: ${response.status} ${body}`);
  }
}
