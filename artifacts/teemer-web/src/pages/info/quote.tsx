import { InfoLayout } from "@/components/layout/info-layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSubmitQuoteRequest } from "@workspace/api-client-react";
import type { QuoteResponse } from "@workspace/api-client-react";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  CheckCircle2, Loader2, ArrowRight, ArrowLeft, Minus, Plus,
  Sparkles, Users, Clock, DollarSign, Calendar, Package,
  ChevronDown, ChevronUp, AlertCircle, Home, Truck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";


const INVENTORY_CATEGORIES = [
  {
    name: "Living Room",
    items: [
      "Sofa", "Loveseat", "Sectional Sofa", "Armchair", "Coffee Table",
      "End Table", "TV", "TV Stand / Entertainment Center", "Bookcase",
      "Floor Lamp", "Area Rug", "Ottoman",
    ],
  },
  {
    name: "Bedroom",
    items: [
      "Twin Bed", "Full/Queen Bed", "King Bed", "Dresser", "Nightstand",
      "Armoire / Wardrobe", "Mirror", "Desk", "Desk Chair",
    ],
  },
  {
    name: "Dining",
    items: [
      "Dining Table", "Dining Chair", "China Cabinet", "Bar Cabinet / Buffet",
    ],
  },
  {
    name: "Kitchen",
    items: [
      "Refrigerator", "Oven / Stove", "Dishwasher", "Microwave",
      "Small Appliances (box)", "Kitchen Island",
    ],
  },
  {
    name: "Office",
    items: [
      "Office Desk", "Office Chair", "Filing Cabinet", "Bookcase",
      "Computer / Monitor Setup", "Printer",
    ],
  },
  {
    name: "Garage & Utility",
    items: [
      "Washer", "Dryer", "Workbench", "Storage Shelving Unit",
      "Generator", "Snow Blower", "Lawn Mower", "Toolbox (large)",
    ],
  },
  {
    name: "Outdoor",
    items: [
      "Patio Table", "Patio Chair", "Outdoor Sofa / Sectional", "Grill / BBQ",
      "Planters (large)", "Outdoor Storage Box",
    ],
  },
  {
    name: "Special / Heavy Items",
    items: [
      "Safe", "Piano (upright)", "Piano (grand)", "Pool Table",
      "Exercise Equipment", "Large Artwork / Painting",
    ],
  },
];


const step1Schema = z.object({
  contactName: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email address"),
  moveDate: z.string().min(1, "Move date is required"),
  arrivalTimeWindow: z.string().optional(),
  pickupAddress: z.string().min(5, "Pickup address is required"),
  dropoffAddress: z.string().min(5, "Drop-off address is required"),
  secondStop: z.string().optional(),
  storageNeeded: z.boolean().default(false),
  additionalNotes: z.string().optional(),
});
type Step1Values = z.infer<typeof step1Schema>;


interface HomeSize {
  numberOfBedrooms: number;
  numberOfLivingRooms: number;
  isFullyFurnished: boolean;
  hasGarage: boolean;
  hasOutdoorFurniture: boolean;
  hasStairs: boolean;
  hasHeavyItems: boolean;
}


const ARRIVAL_WINDOWS = [
  "7:00 AM – 9:00 AM",
  "8:00 AM – 10:00 AM",
  "9:00 AM – 11:00 AM",
  "10:00 AM – 12:00 PM",
  "12:00 PM – 2:00 PM",
  "Flexible (any time)",
];

function fmt(n: number | undefined, fallback = "—") {
  if (n == null) return fallback;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function inputCls(error?: boolean) {
  return `w-full p-4 rounded-xl bg-slate-50 border ${
    error ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-primary/20 focus:border-primary"
  } focus:ring-2 outline-none transition-all text-slate-800 placeholder:text-slate-400`;
}

function labelCls() {
  return "block text-sm font-semibold text-slate-700 mb-2";
}


function StepHeader({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-4 mb-8 pb-5 border-b border-slate-100">
      <span className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow shadow-primary/30">
        {step}
      </span>
      <h3 className="text-2xl font-bold text-slate-800">{title}</h3>
    </div>
  );
}

function ToggleCard({
  checked, onChange, label, description,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
        checked
          ? "border-primary bg-green-50 shadow-sm shadow-primary/10"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
        checked ? "border-primary bg-primary" : "border-slate-300"
      }`}>
        {checked && <span className="w-2 h-2 rounded-full bg-white" />}
      </span>
      <span>
        <span className={`font-semibold text-sm ${checked ? "text-primary" : "text-slate-700"}`}>{label}</span>
        {description && <span className="block text-xs text-slate-500 mt-0.5">{description}</span>}
      </span>
    </button>
  );
}

function CounterButton({ value, onChange, min = 0, max = 10 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-8 text-center font-semibold text-slate-800 text-sm">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}


function InventoryRow({
  item, quantity, onChange,
}: { item: string; quantity: number; onChange: (v: number) => void }) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors ${
      quantity > 0 ? "bg-green-50 border border-primary/20" : "hover:bg-slate-50"
    }`}>
      <span className={`text-sm ${quantity > 0 ? "text-primary font-semibold" : "text-slate-600"}`}>{item}</span>
      <CounterButton value={quantity} onChange={onChange} />
    </div>
  );
}


const STEP_LABELS = ["Move Details", "Home Size", "Inventory", "Box Estimate"];

function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-10">
      <div className="flex justify-between items-start relative">
        <div className="absolute left-0 top-5 w-full h-0.5 bg-slate-100" />
        <div
          className="absolute left-0 top-5 h-0.5 bg-primary transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (STEP_LABELS.length - 1)) * 100}%` }}
        />
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isDone = currentStep > stepNum;
          const isActive = currentStep === stepNum;
          return (
            <div key={stepNum} className="relative flex flex-col items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm z-10 transition-all duration-300 shadow ${
                isDone
                  ? "bg-primary text-white"
                  : isActive
                  ? "bg-primary text-white ring-4 ring-primary/20"
                  : "bg-white border-2 border-slate-200 text-slate-400"
              }`}>
                {isDone ? <CheckCircle2 className="w-5 h-5" /> : stepNum}
              </div>
              <span className={`mt-2 text-xs font-medium text-center leading-tight hidden sm:block ${
                isActive ? "text-primary" : isDone ? "text-slate-600" : "text-slate-400"
              }`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function QuoteResultsScreen({ result, moveDate, onReserve }: {
  result: QuoteResponse; moveDate: string; onReserve: () => void;
}) {
  const q = result;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div className="text-center pb-6 border-b border-slate-100">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Your Estimate Is Ready!</h2>
        <p className="text-slate-500 text-sm">Review your quote below. No obligation — lock it in with a small deposit.</p>
      </div>

      {/* Crew + Rate summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <Users className="w-5 h-5 text-primary" />, label: "Crew Size", value: q.crewSize ? `${q.crewSize} Movers` : "—" },
          { icon: <Clock className="w-5 h-5 text-primary" />, label: "Est. Hours", value: q.estimatedHours ? `${q.estimatedHours} hrs` : "—" },
          { icon: <DollarSign className="w-5 h-5 text-primary" />, label: "Hourly Rate", value: q.hourlyRate ? `$${q.hourlyRate}/hr` : "—" },
        ].map(({ icon, label, value }) => (
          <div key={label} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
            <div className="flex justify-center mb-2">{icon}</div>
            <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
            <p className="font-bold text-slate-800 text-sm">{value}</p>
          </div>
        ))}
      </div>

      {/* Price breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Price Breakdown
          </h3>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">
              Labor ({q.crewSize} movers × ${q.hourlyRate}/hr × {q.estimatedHours} hrs)
            </span>
            <span className="font-semibold text-slate-800">{fmt(q.laborSubtotal)}</span>
          </div>
          {(q.materialsSubtotal ?? 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Packing Materials</span>
              <span className="font-semibold text-slate-800">{fmt(q.materialsSubtotal)}</span>
            </div>
          )}
          <div className="border-t border-dashed border-slate-200 pt-3 flex justify-between">
            <span className="font-bold text-slate-800">Estimated Total</span>
            <span className="font-bold text-xl text-primary">{fmt(q.totalEstimate)}</span>
          </div>
        </div>
        <div className="bg-primary/5 px-6 py-4 border-t border-primary/10">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-slate-800">Deposit Due Today</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {(q.totalEstimate ?? 0) < 1000
                  ? "Flat $50 deposit to reserve your move"
                  : "50% deposit required to reserve your move"}
              </p>
            </div>
            <span className="font-bold text-2xl text-primary">{fmt(q.depositAmount)}</span>
          </div>
        </div>
      </div>

      {/* Move date */}
      {moveDate && (
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
          <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs text-slate-500 font-medium">Your Move Date</p>
            <p className="font-bold text-slate-800">
              {new Date(moveDate + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          </div>
        </div>
      )}

      {/* What's included */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" /> What's Included
          </h3>
        </div>
        <ul className="px-6 py-4 space-y-2.5">
          {[
            "Professional licensed & insured crew",
            "Stretch wrap for all furniture pieces",
            "Moving blankets and pad protection",
            "Full disassembly & reassembly of furniture",
            "Wardrobe boxes (complimentary use on move day)",
            "Gas, tolls, and truck fee included",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Important Notes */}
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 text-sm mb-1">Important Notes</p>
            <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
              <li>This is an estimate — final price is based on actual time used.</li>
              <li>Minimum charge applies (see crew size above).</li>
              <li>Stairs, long carries, or parking issues may affect time.</li>
              <li>10% discount available for Seniors & Veterans.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onReserve}
          className="flex-1 bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
        >
          Reserve My Move <ArrowRight className="w-5 h-5" />
        </button>
        <a
          href="tel:+15162693724"
          className="flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-700 py-4 px-6 rounded-xl font-semibold hover:border-primary hover:text-primary transition-all text-sm"
        >
          Call to Ask Questions
        </a>
      </div>

      <p className="text-center text-xs text-slate-400">
        Quote #: {q.id} · Submitted on {new Date(q.createdAt).toLocaleDateString()}
      </p>
    </motion.div>
  );
}


export default function QuotePage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [quoteResult, setQuoteResult] = useState<QuoteResponse | null>(null);

  // Step 1 (React Hook Form)
  const {
    register, formState: { errors: step1Errors },
    trigger: triggerStep1, watch: watchStep1, getValues: getStep1Values, setValue: setStep1Value,
  } = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: { storageNeeded: false },
  });

  // Step 2: Home size state
  const [homeSize, setHomeSize] = useState<HomeSize>({
    numberOfBedrooms: 2,
    numberOfLivingRooms: 1,
    isFullyFurnished: true,
    hasGarage: false,
    hasOutdoorFurniture: false,
    hasStairs: false,
    hasHeavyItems: false,
  });

  // Step 3: Inventory state
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [customItem, setCustomItem] = useState("");
  const [customItemQty, setCustomItemQty] = useState(1);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "Living Room": true, "Bedroom": true,
  });

  // Step 4: Box estimate state
  const [boxesAlreadyPacked, setBoxesAlreadyPacked] = useState(0);
  const [needsPackingMaterials, setNeedsPackingMaterials] = useState(false);
  const [smallBoxes, setSmallBoxes] = useState(0);
  const [mediumBoxes, setMediumBoxes] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiEstimate, setAiEstimate] = useState<{ small: number; medium: number; note: string } | null>(null);

  const mutation = useSubmitQuoteRequest();


  const goToStep = (s: number) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setStep(s);
  };

  const nextFromStep1 = async () => {
    const valid = await triggerStep1([
      "contactName", "phone", "email", "moveDate",
      "pickupAddress", "dropoffAddress",
    ]);
    if (valid) goToStep(2);
  };


  const handleAiEstimate = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiEstimate(null);
    try {
      const res = await fetch("/api/quotes/estimate-boxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory,
          numberOfBedrooms: homeSize.numberOfBedrooms,
          numberOfLivingRooms: homeSize.numberOfLivingRooms,
          isFullyFurnished: homeSize.isFullyFurnished,
          notes: getStep1Values().additionalNotes || "",
        }),
      });
      if (!res.ok) throw new Error("AI estimation not available yet");
      const data = await res.json();
      setAiEstimate(data);
      if (data.small != null) setSmallBoxes(data.small);
      if (data.medium != null) setMediumBoxes(data.medium);
    } catch {
      setAiError("AI box estimation is coming soon. Please enter your box counts manually.");
    } finally {
      setAiLoading(false);
    }
  };


  const handleFinalSubmit = () => {
    const step1Data = getStep1Values();
    const payload = {
      // Contact & move details
      contactName: step1Data.contactName,
      phone: step1Data.phone,
      email: step1Data.email,
      moveDate: step1Data.moveDate,
      arrivalTimeWindow: step1Data.arrivalTimeWindow || undefined,
      pickupAddress: step1Data.pickupAddress,
      dropoffAddress: step1Data.dropoffAddress,
      secondStop: step1Data.secondStop || undefined,
      storageNeeded: step1Data.storageNeeded,
      additionalNotes: step1Data.additionalNotes || undefined,
      // Legacy compat fields
      originAddress: step1Data.pickupAddress,
      destinationAddress: step1Data.dropoffAddress,
      moveType: "local",
      residentialOrCommercial: "residential",
      // Home size
      numberOfBedrooms: homeSize.numberOfBedrooms,
      numberOfLivingRooms: homeSize.numberOfLivingRooms,
      isFullyFurnished: homeSize.isFullyFurnished,
      hasGarage: homeSize.hasGarage,
      hasOutdoorFurniture: homeSize.hasOutdoorFurniture,
      hasStairs: homeSize.hasStairs,
      hasHeavyItems: homeSize.hasHeavyItems,
      // Inventory
      inventory,
      // Boxes
      boxesAlreadyPacked,
      needsPackingMaterials,
      smallBoxes,
      mediumBoxes,
    };

    mutation.mutate(
      { data: payload },
      {
        onSuccess: (result) => {
          setQuoteResult(result);
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
        onError: (err) => console.error("Failed to submit quote:", err),
      }
    );
  };

  const handleReserve = () => {
    if (quoteResult?.id) {
      navigate(`/info/quote/deposit/${quoteResult.id}`);
    }
  };


  const setItemQty = (item: string, qty: number) => {
    setInventory((prev) => {
      const next = { ...prev };
      if (qty === 0) delete next[item];
      else next[item] = qty;
      return next;
    });
  };

  const addCustomItem = () => {
    const name = customItem.trim();
    if (!name) return;
    setItemQty(name, customItemQty);
    setCustomItem("");
    setCustomItemQty(1);
  };

  const totalItems = Object.values(inventory).reduce((sum, n) => sum + n, 0);


  const previewCrewSize = () => {
    let movers = 2;
    const totalRooms = homeSize.numberOfBedrooms + homeSize.numberOfLivingRooms;
    if (totalRooms <= 2) movers = 2;
    else if (totalRooms === 3) movers = 3;
    else if (totalRooms === 4) movers = 3;
    else movers = 4;
    if (homeSize.hasGarage || homeSize.hasOutdoorFurniture) movers += 1;
    return movers;
  };

  const previewRate = () => {
    const m = previewCrewSize();
    if (m <= 2) return 165;
    if (m === 3) return 200;
    return 300;
  };


  return (
    <InfoLayout>
      <div className="bg-slate-50 py-12 min-h-[calc(100vh-80px)]">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-green-100 text-primary rounded-full px-4 py-1.5 text-sm font-semibold mb-4">
              <Sparkles className="w-4 h-4" /> Free Instant Estimate
            </div>
            <h1 className="text-4xl font-bold font-display text-slate-900 mb-3">
              Get Your Moving Quote
            </h1>
            <p className="text-slate-500 text-lg">
              Answer a few questions and get an exact price — takes under 3 minutes.
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 p-6 md:p-10 border border-slate-100">
            {quoteResult ? (
              <QuoteResultsScreen
                result={quoteResult}
                moveDate={watchStep1("moveDate")}
                onReserve={handleReserve}
              />
            ) : (
              <>
                <ProgressBar currentStep={step} />

                <AnimatePresence mode="wait">

                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.25 }}
                    >
                      <StepHeader step={1} title="Move Details" />
                      <div className="space-y-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className={labelCls()}>Your Name</label>
                            <input
                              {...register("contactName")}
                              placeholder="Jane Smith"
                              className={inputCls(!!step1Errors.contactName)}
                            />
                            {step1Errors.contactName && <p className="text-red-500 text-xs mt-1.5">{step1Errors.contactName.message}</p>}
                          </div>
                          <div>
                            <label className={labelCls()}>Phone Number</label>
                            <input
                              {...register("phone")}
                              type="tel"
                              placeholder="(516) 555-0100"
                              className={inputCls(!!step1Errors.phone)}
                            />
                            {step1Errors.phone && <p className="text-red-500 text-xs mt-1.5">{step1Errors.phone.message}</p>}
                          </div>
                        </div>

                        <div>
                          <label className={labelCls()}>Email Address</label>
                          <input
                            {...register("email")}
                            type="email"
                            placeholder="jane@example.com"
                            className={inputCls(!!step1Errors.email)}
                          />
                          {step1Errors.email && <p className="text-red-500 text-xs mt-1.5">{step1Errors.email.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className={labelCls()}>Planned Move Date</label>
                            <input
                              {...register("moveDate")}
                              type="date"
                              min={new Date().toISOString().split("T")[0]}
                              className={inputCls(!!step1Errors.moveDate)}
                            />
                            {step1Errors.moveDate && <p className="text-red-500 text-xs mt-1.5">{step1Errors.moveDate.message}</p>}
                          </div>
                          <div>
                            <label className={labelCls()}>Preferred Arrival Time</label>
                            <select {...register("arrivalTimeWindow")} className={inputCls()}>
                              <option value="">Any time is fine</option>
                              {ARRIVAL_WINDOWS.map((w) => (
                                <option key={w} value={w}>{w}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className={labelCls()}>Pickup Address</label>
                          <input
                            {...register("pickupAddress")}
                            placeholder="123 Ocean Ave, Long Beach, NY 11561"
                            className={inputCls(!!step1Errors.pickupAddress)}
                          />
                          {step1Errors.pickupAddress && <p className="text-red-500 text-xs mt-1.5">{step1Errors.pickupAddress.message}</p>}
                        </div>

                        <div>
                          <label className={labelCls()}>Drop-off Address</label>
                          <input
                            {...register("dropoffAddress")}
                            placeholder="456 Park Ave, Brooklyn, NY 11201"
                            className={inputCls(!!step1Errors.dropoffAddress)}
                          />
                          {step1Errors.dropoffAddress && <p className="text-red-500 text-xs mt-1.5">{step1Errors.dropoffAddress.message}</p>}
                        </div>

                        <div>
                          <label className={labelCls()}>
                            Second Stop <span className="text-slate-400 font-normal">(optional)</span>
                          </label>
                          <input
                            {...register("secondStop")}
                            placeholder="e.g. Storage unit on the way"
                            className={inputCls()}
                          />
                        </div>

                        <ToggleCard
                          checked={watchStep1("storageNeeded") ?? false}
                          onChange={(v) => setStep1Value("storageNeeded", v)}
                          label="I may need temporary storage"
                          description="We offer secure climate-controlled units starting at $150/month"
                        />

                        <div>
                          <label className={labelCls()}>
                            Additional Notes <span className="text-slate-400 font-normal">(optional)</span>
                          </label>
                          <textarea
                            {...register("additionalNotes")}
                            placeholder="Piano, safe, stairs, COI needed, elevator reservations, access restrictions…"
                            rows={3}
                            className={`${inputCls()} resize-none`}
                          />
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={nextFromStep1}
                            className="bg-primary text-white px-8 py-4 rounded-xl font-bold hover:bg-primary/90 flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
                          >
                            Next: Home Size <ArrowRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.25 }}
                    >
                      <StepHeader step={2} title="Home Size" />
                      <div className="space-y-6">

                        {/* Bedrooms */}
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Home className="w-5 h-5 text-primary" />
                              <span className="font-semibold text-slate-700">Bedrooms</span>
                            </div>
                            <CounterButton
                              value={homeSize.numberOfBedrooms}
                              onChange={(v) => setHomeSize((h) => ({ ...h, numberOfBedrooms: v }))}
                              max={6}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Home className="w-5 h-5 text-primary" />
                              <span className="font-semibold text-slate-700">Living Rooms</span>
                            </div>
                            <CounterButton
                              value={homeSize.numberOfLivingRooms}
                              onChange={(v) => setHomeSize((h) => ({ ...h, numberOfLivingRooms: v }))}
                              min={0}
                              max={3}
                            />
                          </div>
                        </div>

                        {/* Toggles */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <ToggleCard
                            checked={homeSize.isFullyFurnished}
                            onChange={(v) => setHomeSize((h) => ({ ...h, isFullyFurnished: v }))}
                            label="Fully Furnished"
                            description="Beds, sofas, full furniture in all rooms"
                          />
                          <ToggleCard
                            checked={homeSize.hasGarage}
                            onChange={(v) => setHomeSize((h) => ({ ...h, hasGarage: v }))}
                            label="Has Garage"
                            description="Items to move from a garage (+1 mover)"
                          />
                          <ToggleCard
                            checked={homeSize.hasOutdoorFurniture}
                            onChange={(v) => setHomeSize((h) => ({ ...h, hasOutdoorFurniture: v }))}
                            label="Outdoor Furniture"
                            description="Patio sets, grills, large planters (+1 mover)"
                          />
                          <ToggleCard
                            checked={homeSize.hasStairs}
                            onChange={(v) => setHomeSize((h) => ({ ...h, hasStairs: v }))}
                            label="Stairs Involved"
                            description="At pickup or drop-off location"
                          />
                          <ToggleCard
                            checked={homeSize.hasHeavyItems}
                            onChange={(v) => setHomeSize((h) => ({ ...h, hasHeavyItems: v }))}
                            label="Heavy / Bulky Items"
                            description="Piano, safe, pool table, large appliances"
                          />
                        </div>

                        {/* Live crew preview */}
                        <div className="bg-green-50 border border-primary/20 rounded-2xl p-5">
                          <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">
                            Estimated Crew for Your Move
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                              <p className="text-3xl font-bold text-slate-800">{previewCrewSize()}</p>
                              <p className="text-sm text-slate-500">Movers</p>
                            </div>
                            <div className="text-center">
                              <p className="text-3xl font-bold text-slate-800">${previewRate()}</p>
                              <p className="text-sm text-slate-500">Per Hour</p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-3 text-center">
                            Based on {homeSize.numberOfBedrooms} bed{homeSize.numberOfBedrooms !== 1 ? "s" : ""} + {homeSize.numberOfLivingRooms} living room{homeSize.numberOfLivingRooms !== 1 ? "s" : ""}
                            {homeSize.hasGarage || homeSize.hasOutdoorFurniture ? " + extra space" : ""}
                          </p>
                        </div>

                        <div className="flex justify-between pt-2">
                          <button type="button" onClick={() => goToStep(1)} className="flex items-center gap-2 text-slate-500 font-semibold px-4 py-3 hover:bg-slate-100 rounded-xl transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Back
                          </button>
                          <button type="button" onClick={() => goToStep(3)} className="bg-primary text-white px-8 py-4 rounded-xl font-bold hover:bg-primary/90 flex items-center gap-2 transition-all shadow-lg shadow-primary/20">
                            Next: Inventory <ArrowRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.25 }}
                    >
                      <StepHeader step={3} title="Inventory" />
                      <p className="text-slate-500 text-sm mb-6 -mt-4">
                        Select items you're moving to improve your estimate.{" "}
                        <span className="text-primary font-medium">You can skip this step</span> if you prefer.
                      </p>

                      {totalItems > 0 && (
                        <div className="mb-4 inline-flex items-center gap-2 bg-green-50 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-semibold">
                          <Package className="w-4 h-4" />
                          {totalItems} item{totalItems !== 1 ? "s" : ""} selected
                        </div>
                      )}

                      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 rounded-xl">
                        {INVENTORY_CATEGORIES.map((cat) => {
                          const isOpen = expandedCategories[cat.name] ?? false;
                          const catTotal = cat.items.reduce((s, item) => s + (inventory[item] ?? 0), 0);
                          return (
                            <div key={cat.name} className="border border-slate-200 rounded-xl overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setExpandedCategories((prev) => ({ ...prev, [cat.name]: !isOpen }))}
                                className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-slate-800 text-sm">{cat.name}</span>
                                  {catTotal > 0 && (
                                    <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                      {catTotal}
                                    </span>
                                  )}
                                </div>
                                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                              </button>
                              {isOpen && (
                                <div className="px-3 pb-3 pt-1 space-y-1.5 bg-white">
                                  {cat.items.map((item) => (
                                    <InventoryRow
                                      key={item}
                                      item={item}
                                      quantity={inventory[item] ?? 0}
                                      onChange={(qty) => setItemQty(item, qty)}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Custom item entry */}
                      <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-sm font-semibold text-slate-700 mb-3">Add a custom item</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customItem}
                            onChange={(e) => setCustomItem(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomItem(); } }}
                            placeholder="Item name (e.g. 'Arcade Cabinet')"
                            className="flex-1 p-3 rounded-lg bg-white border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                          />
                          <CounterButton value={customItemQty} onChange={setCustomItemQty} min={1} max={20} />
                          <button
                            type="button"
                            onClick={addCustomItem}
                            disabled={!customItem.trim()}
                            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between pt-4">
                        <button type="button" onClick={() => goToStep(2)} className="flex items-center gap-2 text-slate-500 font-semibold px-4 py-3 hover:bg-slate-100 rounded-xl transition-colors">
                          <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                        <button type="button" onClick={() => goToStep(4)} className="bg-primary text-white px-8 py-4 rounded-xl font-bold hover:bg-primary/90 flex items-center gap-2 transition-all shadow-lg shadow-primary/20">
                          Next: Boxes <ArrowRight className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {step === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.25 }}
                    >
                      <StepHeader step={4} title="Box Estimate" />
                      <div className="space-y-6">

                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-5">
                          {/* Boxes already packed */}
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-700 text-sm">Boxes Already Packed</p>
                              <p className="text-xs text-slate-500 mt-0.5">Boxes you've already filled before move day</p>
                            </div>
                            <CounterButton value={boxesAlreadyPacked} onChange={setBoxesAlreadyPacked} max={200} />
                          </div>

                          {/* Packing materials toggle */}
                          <ToggleCard
                            checked={needsPackingMaterials}
                            onChange={setNeedsPackingMaterials}
                            label="I need packing materials from Teemer"
                            description="Stretch wrap, tape, and boxes delivered on move day"
                          />

                          {/* Box quantities */}
                          <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="bg-white rounded-xl border border-slate-200 p-4">
                              <div className="flex items-center gap-2 mb-1">
                                <Package className="w-4 h-4 text-primary" />
                                <p className="font-semibold text-slate-700 text-sm">Small Boxes</p>
                              </div>
                              <p className="text-xs text-slate-400 mb-3">$3.50 each · 1.5 cu ft</p>
                              <CounterButton value={smallBoxes} onChange={setSmallBoxes} max={100} />
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4">
                              <div className="flex items-center gap-2 mb-1">
                                <Package className="w-4 h-4 text-primary" />
                                <p className="font-semibold text-slate-700 text-sm">Medium Boxes</p>
                              </div>
                              <p className="text-xs text-slate-400 mb-3">$6.50 each · 3.0 cu ft</p>
                              <CounterButton value={mediumBoxes} onChange={setMediumBoxes} max={100} />
                            </div>
                          </div>
                        </div>

                        {/* AI Estimate Section */}
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Sparkles className="w-5 h-5 text-amber-500" />
                                <p className="font-bold text-slate-800 text-sm">Estimate Boxes with AI</p>
                              </div>
                              <p className="text-xs text-slate-500">
                                Based on your inventory, our AI will suggest how many boxes you'll need.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleAiEstimate}
                              disabled={aiLoading}
                              className="flex-shrink-0 flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-amber-600 disabled:opacity-60 transition-colors shadow-md shadow-amber-500/20"
                            >
                              {aiLoading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Estimating…</>
                              ) : (
                                <><Sparkles className="w-4 h-4" /> Estimate</>
                              )}
                            </button>
                          </div>

                          {aiError && (
                            <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              {aiError}
                            </div>
                          )}

                          {aiEstimate && (
                            <div className="mt-3 bg-green-50 border border-primary/20 rounded-xl p-4">
                              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
                                AI Suggestion Applied
                              </p>
                              <div className="flex gap-6 text-sm">
                                <span className="text-slate-700"><strong className="text-slate-900">{aiEstimate.small}</strong> small boxes</span>
                                <span className="text-slate-700"><strong className="text-slate-900">{aiEstimate.medium}</strong> medium boxes</span>
                              </div>
                              {aiEstimate.note && <p className="text-xs text-slate-500 mt-1.5">{aiEstimate.note}</p>}
                              <p className="text-xs text-slate-400 mt-1">You can adjust the counts above if needed.</p>
                            </div>
                          )}
                        </div>

                        {mutation.isError && (
                          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <span>
                              Something went wrong submitting your request. Please try again or call us at{" "}
                              <a href="tel:+15162693724" className="font-semibold underline">(516) 269-3724</a>.
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between pt-2">
                          <button type="button" onClick={() => goToStep(3)} className="flex items-center gap-2 text-slate-500 font-semibold px-4 py-3 hover:bg-slate-100 rounded-xl transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Back
                          </button>
                          <button
                            type="button"
                            onClick={handleFinalSubmit}
                            disabled={mutation.isPending}
                            className="bg-primary text-white px-8 py-4 rounded-xl font-bold hover:bg-primary/90 flex items-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-60"
                          >
                            {mutation.isPending ? (
                              <><Loader2 className="w-5 h-5 animate-spin" /> Calculating…</>
                            ) : (
                              <><Truck className="w-5 h-5" /> Get My Quote</>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                </AnimatePresence>
              </>
            )}
          </div>

          {/* Trust badges */}
          {!quoteResult && (
            <div className="mt-8 grid grid-cols-3 gap-4 text-center">
              {[
                { label: "Licensed & Insured", sub: "Fully covered in NY" },
                { label: "Free Estimates", sub: "No obligation quote" },
                { label: "10% Off", sub: "Seniors & Veterans" },
              ].map(({ label, sub }) => (
                <div key={label} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                  <p className="font-bold text-slate-800 text-sm">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </InfoLayout>
  );
}
