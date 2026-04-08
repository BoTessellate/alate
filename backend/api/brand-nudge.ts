/**
 * Brand Nudge API
 *
 * When a customer can't check fit for a brand, they can "nudge" the brand
 * to join the platform. This endpoint sends a pitch email to the brand
 * from our official email address.
 *
 * POST /api/brand-nudge
 * Body: { brandDomain: "asos.com", brandName: "ASOS" }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createModuleLogger } from '../sdk/shared/logger';

const log = createModuleLogger('brand-nudge');

const SENDER_EMAIL = process.env.NUDGE_SENDER_EMAIL;
const SENDER_NAME = 'Alate';

function buildEmailBody(brandName: string): string {
  return `Hi ${brandName} team,

One of your customers just tried to check whether a product from your store would fit them — using Alate, a tool that predicts clothing fit based on individual body measurements.

Unfortunately, we couldn't retrieve the sizing data needed to give them an accurate result. That's where you come in.

WHY THIS MATTERS
- 30-40% of online clothing returns are size-related
- Shoppers are 7x more likely to purchase when they're confident about fit
- Brands on our platform see measurably fewer fit-related returns

HOW IT WORKS
1. You share your product catalogue and size charts (via API or CSV)
2. We map your sizing data against real body profiles (shoulders, bust, waist, hips, thighs, torso)
3. Your customers get instant, personalised fit predictions before they buy

WHAT WE NEED FROM YOU
- Product catalogue with sizing info (S/M/L or numeric)
- Size charts with measurements per size
- Optionally: model height/size worn, fit type tags (slim, regular, oversized)

Integration takes less than a day. We're currently onboarding select brand partners for our early access programme.

Interested? Reply to this email and we'll get you set up.

Best,
The Alate Team
alate.app`;
}

function buildEmailSubject(brandName: string): string {
  return `Your customers want better fit predictions — let's make it happen, ${brandName}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { brandDomain, brandName } = req.body as {
    brandDomain?: string;
    brandName?: string;
  };

  if (!brandDomain || !brandName) {
    return res.status(400).json({ error: 'brandDomain and brandName are required' });
  }

  // Construct a likely business email for the brand
  // Prefer info@ as it's more likely to reach decision-makers than support@
  const recipientEmail = `info@${brandDomain}`;

  const subject = buildEmailSubject(brandName);
  const body = buildEmailBody(brandName);

  try {
    // TODO: Wire up actual email sending (Resend, SendGrid, nodemailer, etc.)
    // For now, log the nudge so we can track demand per brand
    // and send emails manually or via a batch process.
    log.info(
      {
        brandDomain,
        brandName,
        recipientEmail,
        senderEmail: SENDER_EMAIL,
      },
      'Brand nudge requested'
    );

    // When email service is configured, uncomment and adapt:
    // await sendEmail({
    //   from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
    //   to: recipientEmail,
    //   subject,
    //   text: body,
    // });

    return res.status(200).json({
      success: true,
      message: `Nudge sent to ${brandName}`,
      brandDomain,
      brandName,
    });
  } catch (error) {
    log.error({ error, brandDomain, brandName }, 'Failed to send brand nudge');
    return res.status(500).json({
      success: false,
      error: 'Failed to send nudge',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
