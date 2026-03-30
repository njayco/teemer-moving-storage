import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "wouter";
import { FileText, CheckCircle, AlertCircle, Loader2, RotateCcw, PenLine } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

interface ContractData {
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  pickupAddress2?: string;
  dropoffAddress: string;
  crewSize?: number;
  estimatedHours?: number;
  moveDate?: string;
  arrivalWindow?: string;
  inventory?: Record<string, number>;
  additionalNotes?: string;
  jobId?: string;
  quoteId?: number;
  totalEstimate?: number;
}

interface ContractRecord {
  id: number;
  status: string;
  customerSignedAt: string | null;
  contractData: ContractData;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b-2 border-green-500 pb-1 mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm mb-1">
      <span className="text-slate-500 w-36 shrink-0">{label}</span>
      <span className="text-slate-800 font-medium">{value || "—"}</span>
    </div>
  );
}

function LegalBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-4">
      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">{title}</h4>
      <p className="text-xs text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}

function SignatureCanvas({ onChange }: { onChange: (data: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    isDrawing.current = false;
    lastPos.current = null;
    if (canvasRef.current) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <PenLine className="w-4 h-4 text-green-600" />
          Draw your signature below
        </span>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 border border-slate-200 rounded px-2 py-1"
        >
          <RotateCcw className="w-3 h-3" /> Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={140}
        className="w-full border-2 border-dashed border-slate-300 rounded-xl bg-white cursor-crosshair touch-none"
        style={{ height: 140 }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <p className="text-xs text-slate-400 mt-1 text-center">Sign with your mouse or finger</p>
    </div>
  );
}

export default function SignContractPage() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/contracts/sign/${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Contract not found");
          return;
        }
        const data: ContractRecord = await res.json();
        setContract(data);
        if (data.status === "signed") {
          setSigned(true);
          setSignedAt(data.customerSignedAt);
        }
      } catch (_e) {
        setError("Failed to load contract. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSubmit = async () => {
    if (!signatureData) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/contracts/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureData }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to sign. Please try again.");
        return;
      }
      setSigned(true);
      setSignedAt(data.signedAt);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-green-500 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading your contract…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-800 mb-2">Contract Not Found</h2>
          <p className="text-slate-500 text-sm">{error}</p>
          <p className="text-slate-400 text-xs mt-4">If you believe this is an error, please contact us at (516) 269-3724.</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Contract Signed!</h2>
          <p className="text-slate-600 text-sm mb-2">
            Thank you, <strong>{contract?.contractData?.customerName}</strong>. Your moving contract has been successfully signed.
          </p>
          {signedAt && (
            <p className="text-slate-400 text-xs">
              Signed on {new Date(signedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
            </p>
          )}
          <div className="mt-6 bg-green-50 rounded-xl p-4 text-left">
            <p className="text-xs text-green-700 font-medium mb-1">Your move is confirmed:</p>
            {contract?.contractData?.moveDate && (
              <p className="text-xs text-green-600">Date: {contract.contractData.moveDate}</p>
            )}
            {contract?.contractData?.pickupAddress && (
              <p className="text-xs text-green-600 mt-0.5">From: {contract.contractData.pickupAddress}</p>
            )}
            {contract?.contractData?.dropoffAddress && (
              <p className="text-xs text-green-600 mt-0.5">To: {contract.contractData.dropoffAddress}</p>
            )}
          </div>
          <p className="text-slate-400 text-xs mt-5">Questions? Call us at (516) 269-3724</p>
        </div>
      </div>
    );
  }

  const cd = contract!.contractData;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="bg-[#0B132B] text-white py-5 px-4 text-center">
        <h1 className="text-xl font-bold tracking-wide">TEEMER MOVING & STORAGE CORP.</h1>
        <p className="text-green-400 text-xs mt-1">Long Beach, NY 11561  •  (516) 269-3724</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Moving Contract</h2>
              <p className="text-xs text-slate-500">Please review the details below, then sign to confirm your move.</p>
            </div>
          </div>

          <Section title="Contract Overview">
            <DetailRow label="Mover" value="Teemer Moving and Storage Corp" />
            <DetailRow label="Customer" value={cd.customerName} />
            <DetailRow label="Phone" value={cd.customerPhone} />
          </Section>

          <Section title="Destination Route">
            <DetailRow label="Pick up address" value={cd.pickupAddress} />
            {cd.pickupAddress2 && <DetailRow label="Pick up address 2" value={cd.pickupAddress2} />}
            <DetailRow label="Drop off address" value={cd.dropoffAddress} />
          </Section>

          <Section title="Services">
            {cd.crewSize && (
              <DetailRow label="Men and Equipment" value={`${cd.crewSize} men and ${Math.ceil(cd.crewSize / 3)} truck${Math.ceil(cd.crewSize / 3) > 1 ? "s" : ""}`} />
            )}
            {cd.estimatedHours && (
              <DetailRow label="Labor time" value={`${cd.estimatedHours} hours (minimum)`} />
            )}
            {cd.moveDate && (
              <DetailRow
                label="Scheduled date"
                value={cd.arrivalWindow ? `${cd.moveDate} from approximately ${cd.arrivalWindow}` : cd.moveDate}
              />
            )}
          </Section>

          {cd.inventory && Object.keys(cd.inventory).length > 0 && (
            <Section title="List of Items">
              <ul className="text-sm text-slate-700 space-y-1 pl-2">
                {Object.entries(cd.inventory).filter(([, qty]) => qty > 0).map(([item, qty]) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    {item}{qty > 1 ? ` (×${qty})` : ""}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {cd.additionalNotes && (
            <Section title="Description / Notes">
              <p className="text-sm text-slate-600">{cd.additionalNotes}</p>
            </Section>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-4">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Terms & Conditions</h3>

          <LegalBlock
            title="DAMAGES"
            body="Although our moving staff will be as careful as possible, from time to time damages may occur. If a damage is caused by our staff, at our discretion, we will repair the item or compensate for its depreciated value. Any fragile articles that are not packed and unpacked by Mover will only be moved at the owner's risk. Because the mechanical condition of electronics and appliances is unknown, we only assume responsibility for items which are mishandled or receive visible damage by our staff. We are not responsible for unprotected flooring. If due to an inherent weakness in a piece of furniture (i.e. defect, prior repair, unstable construction) a damage occurs, you understand that we will not be liable for any damage(s) to that piece. Mover is only responsible for items in their immediate care. Mover assumes no responsibility for money, jewelry, or other valuables; please make sure these items are safely put away before our crew arrives. Mover will not be responsible for claims not specified on this contract. Please inspect all goods prior to the crew arriving."
          />
          <LegalBlock
            title="TERMS"
            body="This contract shall remain in effect from the move date listed above until the completion of relocation of all items referenced on the Inventory List and delivery of payment in full to Teemer Moving and Storage Corp. If time taken to complete the move exceeds the anticipated time, we will charge for the additional hours of labor."
          />
          <LegalBlock
            title="CONFIDENTIALITY"
            body="Mover, and its employees or representatives will not at any time or in any manner, either directly or indirectly, use for the personal benefit of Client, or divulge, disclose, or communicate in any manner, any information that is proprietary to Client. Mover and its employees or representatives will protect such information and treat it as strictly confidential. This provision will continue to be effective after the termination of this Contract."
          />
          <LegalBlock
            title="INDEMNIFICATION"
            body="The client agrees to indemnify and hold harmless the moving company, its employees, and agents from any and all claims, damages, or liabilities arising from the client's own negligence, actions, or omissions. This includes, but is not limited to, damages resulting from the client's failure to properly prepare items for transport, providing inaccurate information, or interfering with the moving process. Furthermore, the client agrees to indemnify the moving company for damages caused by circumstances beyond the moving company's reasonable control, such as acts of nature, civil unrest, or defects in the client's property that are not discoverable by reasonable inspection. The moving company shall not be liable for any loss or damage unless it is directly caused by the moving company's gross negligence or willful misconduct."
          />
          <LegalBlock
            title="PAYMENT"
            body="Payment for the services listed under this contract can be made by any of the following options: Cash, Check or PayPal. Online payments will be charged a 5% processing fee. If any invoice is not paid when due, interest will be added to and payable on all overdue amounts at 5% per year, or the maximum percentage allowed under applicable laws, whichever is less. If the price exceeds the amount of $1,000, half payment is required before a move is booked. Weekend moves will be charged a fee of 5%."
          />
          <LegalBlock
            title="CANCELLATIONS"
            body="Mover requests 24 hour notice for last-minute appointments and 2 weeks notice for scheduled advanced appointments. If prior notice is not given, the client will be charged a late fee of $75 for the missed appointment."
          />
          <LegalBlock
            title="WARRANTY"
            body="Mover shall provide its services and meet its obligations under this Contract in a timely and workmanlike manner, using knowledge and recommendations for performing the services which meet generally acceptable standards in Mover's community and region, and will provide a standard of care equal to, or superior to, care used by movers similar to Mover on similar projects."
          />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-4">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Your Signature</h3>
          <SignatureCanvas onChange={setSignatureData} />

          <div className="mt-5 flex items-start gap-3">
            <input
              id="agree"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-green-500"
            />
            <label htmlFor="agree" className="text-sm text-slate-700 cursor-pointer leading-snug">
              I have read and agree to the terms and conditions outlined in this contract. I understand this serves as my electronic signature.
            </label>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!signatureData || !agreed || submitting}
            className="mt-5 w-full bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
            ) : (
              <><CheckCircle className="w-4 h-4" /> I Agree and Sign</>
            )}
          </button>

          {!signatureData && (
            <p className="text-xs text-slate-400 text-center mt-2">Please draw your signature above to continue</p>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 px-4">
          By signing electronically, you agree this constitutes a valid signature with the same legal effect as a handwritten signature.
        </p>
      </div>
    </div>
  );
}
