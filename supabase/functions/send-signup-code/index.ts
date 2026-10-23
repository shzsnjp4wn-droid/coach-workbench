import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const { email, code, role } = await req.json();
    if (!email || !code) {
      return new Response(JSON.stringify({ ok: false, error: "email and code required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("RESEND_FROM") || "IRON//WORKBENCH <onboarding@resend.dev>";

    if (!resendKey) {
      return new Response(JSON.stringify({ ok: false, reason: "no_mailer" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const subject = "Your IRON//WORKBENCH verification code";
    const html = `
      <div style="font-family: sans-serif; line-height: 1.5;">
        <h2>Verification code</h2>
        <p>Use this code to finish creating your ${role || "account"}:</p>
        <p style="font-size: 28px; letter-spacing: 0.25em; font-weight: 700;">${code}</p>
        <p style="color: #666;">It expires in 30 minutes. If you did not request this, ignore the email.</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html,
        text: `Your IRON//WORKBENCH verification code is ${code}. It expires in 30 minutes.`,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("resend failed", detail);
      return new Response(JSON.stringify({ ok: false, reason: "resend_error", detail }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
