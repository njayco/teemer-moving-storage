import { InfoLayout } from "@/components/layout/info-layout";

export default function TermsPage() {
  return (
    <InfoLayout>
      <section className="py-16 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-3xl font-bold font-display text-secondary mb-2">
            Privacy Policy &amp; Terms of Service
          </h1>
          <p className="text-slate-500 text-sm mb-10">
            Teemer Moving &amp; Storage Corp. &mdash; Long Beach, NY 11561
          </p>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 md:p-10 space-y-8 text-slate-700 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-secondary mb-4">
                1. Cost of Service &amp; Payment Terms
              </h2>

              <h3 className="font-semibold text-slate-800 mb-2">Deposit Payment</h3>
              <ul className="list-disc pl-5 space-y-3 text-sm">
                <li>
                  To secure your move date, binding quote flat rate fee and your requested moving
                  services, a <strong>$50 deposit</strong> is required on booking.
                </li>
                <li>
                  You have <strong>24 hours</strong> to pay your deposit to secure your move date
                  and binding quote flat rate fee, from the date and time it is sent from your
                  confirmation. Teemer Moving and Storage Corp has the right to change the original
                  quoted flat rate fee on the customer&rsquo;s requested services if the customer
                  does not pay their deposit within 24 hours.
                </li>
                <li>
                  TMS cannot guarantee availability if the deposit is not paid within 24 hours.
                  The quoted flat rate fee is subject to change due to peak moving days and
                  availability.
                </li>
                <li>
                  If your quoted move is greater than <strong>$2,000</strong>, a{" "}
                  <strong>10% deposit</strong> of your total quoted moving fee is required on
                  booking to secure your move date and your requested moving services.
                </li>
                <li>
                  If you request a refund either the day of your move, or within 1 business day
                  before your move date, <strong>you will not be refunded your deposit</strong>.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-slate-800 mb-2">
                Cancellations &amp; Moving Date Changes
              </h3>
              <ul className="list-disc pl-5 space-y-3 text-sm">
                <li>
                  To cancel your move and requested TMS service, a minimum period of notice of no
                  less than <strong>1 business day or 24 hours</strong> prior to your move date is
                  required in order for you to obtain a full refund of your deposit and avoid
                  additional penalties.
                </li>
                <li>
                  To reschedule your move date with TMS service, we require a minimum period of
                  notice of <strong>1 business day</strong> prior to your booked move date.
                  Penalties will apply if we are not informed within these guidelines of our
                  rescheduling date.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-slate-800 mb-2">Additional Charges</h3>
              <ul className="list-disc pl-5 space-y-3 text-sm">
                <li>
                  If on the day of your move, you have more items that are not reflected on your
                  quoted and original inventory list, you will be provided with an updated quote
                  for moving the additional items. For TMS to move your additional items you will
                  be required to review your updated quote and will be charged an additional
                  moving fee for those items.
                </li>
                <li>
                  If there is no parking within 150 feet of the entrance of the pickup and drop
                  off locations, an excessive carrying and pushing fee is applicable depending on
                  volume and distance. The moving crew will advise the customer of this and inform
                  the moving consultant who booked this service for the customer to charge the
                  additional fee, this depends on the volume of your move, with the{" "}
                  <strong>maximum fee of $300</strong>.
                </li>
                <li>
                  Payment of parking tickets are the responsibility of Teemer Moving and Storage Corp.
                </li>
              </ul>
            </section>

            <div className="border-t border-slate-200 pt-6 text-xs text-slate-400 text-center">
              &copy; {new Date().getFullYear()} Teemer Moving &amp; Storage Corp. All rights reserved.
            </div>
          </div>
        </div>
      </section>
    </InfoLayout>
  );
}
