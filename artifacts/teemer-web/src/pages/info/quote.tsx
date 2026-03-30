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
  ChevronDown, ChevronUp, AlertCircle, Home, Truck, Building2,
  Trash2,
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


const COMMERCIAL_INVENTORY_CATEGORIES = [
  {
    name: "Office Equipment",
    items: [
      "Office Desk", "Executive Desk", "Office Chair", "Ergonomic Chair",
      "Conference Table", "Filing Cabinet", "Bookcase / Shelving",
      "Computer / Monitor Setup", "Server / Network Rack", "Printer / Copier",
      "Reception Desk", "Cubicle / Workstation Panel",
    ],
  },
  {
    name: "Retail & Display",
    items: [
      "Display Case / Showcase", "Clothing Rack", "Shelving Unit (heavy)",
      "Point-of-Sale Counter", "Mannequin", "Shop Fixtures", "Storage Cabinet",
    ],
  },
  {
    name: "Art & Fragile Items",
    items: [
      "Large Artwork / Painting", "Sculpture / Installation",
      "Display Pedestal", "Framed Mirror (large)", "Glass Display Case",
    ],
  },
  {
    name: "Industrial & Storage",
    items: [
      "Pallet Racking Unit", "Heavy Shelving System", "Workbench",
      "Industrial Equipment (misc.)", "Storage Container", "Safe / Vault",
    ],
  },
  {
    name: "Hospitality & Restaurant",
    items: [
      "Restaurant Table", "Restaurant Chair / Barstool", "Bar Equipment",
      "Commercial Refrigerator", "Commercial Oven / Range",
      "Booth Seating Unit", "Hotel Bed Frame", "Hotel Dresser / Armoire",
    ],
  },
  {
    name: "Medical & Specialty",
    items: [
      "Exam Table", "Medical Cabinet", "Lab Equipment (misc.)",
      "Waiting Room Chair", "Reception Counter", "Medical Shelving",
    ],
  },
];

const COMMERCIAL_BUSINESS_TYPES = [
  "Office",
  "Retail Store",
  "Art Gallery",
  "Warehouse",
  "Restaurant / Café",
  "Medical Office",
  "Hotel / Hospitality",
  "Other",
];

const COMMERCIAL_SIZE_TIERS = [
  { value: "small" as const, label: "Small", sqft: "Under 500 sq ft", min: "$1,000", example: "Small office, studio" },
  { value: "medium" as const, label: "Medium", sqft: "500–1,000 sq ft", min: "$3,000", example: "Mid-size office, boutique" },
  { value: "large" as const, label: "Large", sqft: "1,000–2,500 sq ft", min: "$6,000", example: "Full floor, restaurant" },
  { value: "enterprise" as const, label: "Enterprise", sqft: "2,500+ sq ft", min: "$10,000", example: "Warehouse, large office" },
];

const STEP_LABELS_RESIDENTIAL = ["Move Details", "Home Size", "Inventory", "Box Estimate"];
const STEP_LABELS_COMMERCIAL = ["Move Details", "Business Details", "Inventory", "Box Estimate"];
const STEP_LABELS_JUNK = ["Details", "Load & Add-ons"];

type ServiceType = "moving" | "junk_removal";

const JUNK_LOAD_SIZES = [
  { value: "small" as const, label: "Small Load", range: "$150 – $250", description: "A few items, single room cleanout", icon: "📦" },
  { value: "medium" as const, label: "Medium Load", range: "$300 – $450", description: "Multiple rooms, garage cleanout", icon: "🚛" },
  { value: "large" as const, label: "Large Load", range: "$450 – $700", description: "Full apartment, large basement", icon: "🏠" },
  { value: "full_truck" as const, label: "Full Truck", range: "$600 – $900+", description: "Whole house, estate cleanout", icon: "🚚" },
] as const;

const JUNK_ADDONS = [
  { key: "stairs", label: "Stairs", description: "+$50 per flight", perUnit: true, unitLabel: "flights" },
  { key: "heavy", label: "Heavy Items", description: "+$62.50 each (appliances, couches)", perUnit: true, unitLabel: "items" },
  { key: "debris", label: "Construction Debris", description: "+$125 (dump fees)", perUnit: false },
  { key: "sameDay", label: "Same-Day Service", description: "+$50", perUnit: false },
  { key: "hazard", label: "Hazardous Items", description: "+$125 (paint, chemicals, etc.)", perUnit: false },
] as const;

function ProgressBar({ currentStep, stepLabels }: { currentStep: number; stepLabels: string[] }) {
  return (
    <div className="mb-10">
      <div className="flex justify-between items-start relative">
        <div className="absolute left-0 top-5 w-full h-0.5 bg-slate-100" />
        <div
          className="absolute left-0 top-5 h-0.5 bg-primary transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (stepLabels.length - 1)) * 100}%` }}
        />
        {stepLabels.map((label, i) => {
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
  const isCommercialResult = (q.commercialAdjustment ?? 0) > 0 || q.quoteRequest?.isCommercial;
  const isJunkResult = q.quoteRequest?.serviceType === "junk_removal";
  const junkBase = q.junkBasePrice;
  const junkAddons = q.junkAddonsTotal;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div className="text-center pb-6 border-b border-slate-100">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isJunkResult ? "bg-orange-100" : "bg-green-100"}`}>
          {isJunkResult ? <Trash2 className="w-8 h-8 text-orange-500" /> : <CheckCircle2 className="w-8 h-8 text-primary" />}
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Your Estimate Is Ready!</h2>
        <p className="text-slate-500 text-sm">Review your quote below. No obligation — lock it in with a small deposit.</p>
        {isJunkResult && (
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 rounded-full px-4 py-1.5 text-sm font-semibold mt-3">
            <Trash2 className="w-4 h-4" /> Junk Removal Service
          </div>
        )}
        {isCommercialResult && !isJunkResult && (
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 rounded-full px-4 py-1.5 text-sm font-semibold mt-3">
            <Building2 className="w-4 h-4" /> Commercial Move Rate Applied
          </div>
        )}
      </div>

      {isJunkResult ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <Trash2 className="w-5 h-5 text-orange-500" />, label: "Load Size", value: (q.quoteRequest?.junkLoadSize ?? "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "—" },
              { icon: <DollarSign className="w-5 h-5 text-orange-500" />, label: "Total Estimate", value: fmt(q.totalEstimate) },
            ].map(({ icon, label, value }) => (
              <div key={label} className="bg-orange-50 rounded-xl p-4 text-center border border-orange-100">
                <div className="flex justify-center mb-2">{icon}</div>
                <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
                <p className="font-bold text-slate-800 text-sm">{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-orange-50 px-6 py-4 border-b border-orange-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-orange-500" /> Price Breakdown
              </h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Base Price ({(q.quoteRequest?.junkLoadSize ?? "").replace(/_/g, " ")} load)</span>
                <span className="font-semibold text-slate-800">{fmt(junkBase)}</span>
              </div>
              {(junkAddons ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Add-ons Total</span>
                  <span className="font-semibold text-slate-800">{fmt(junkAddons)}</span>
                </div>
              )}
              {(q.quoteRequest?.junkStairsFlights ?? 0) > 0 && (
                <div className="flex justify-between text-xs text-slate-500 pl-4">
                  <span>Stairs ({q.quoteRequest?.junkStairsFlights} flight{(q.quoteRequest?.junkStairsFlights ?? 0) > 1 ? "s" : ""})</span>
                  <span>{fmt((q.quoteRequest?.junkStairsFlights ?? 0) * 50)}</span>
                </div>
              )}
              {(q.quoteRequest?.junkHeavyItemsCount ?? 0) > 0 && (
                <div className="flex justify-between text-xs text-slate-500 pl-4">
                  <span>Heavy Items ({q.quoteRequest?.junkHeavyItemsCount})</span>
                  <span>{fmt((q.quoteRequest?.junkHeavyItemsCount ?? 0) * 62.5)}</span>
                </div>
              )}
              {q.quoteRequest?.junkConstructionDebris && (
                <div className="flex justify-between text-xs text-slate-500 pl-4">
                  <span>Construction Debris</span>
                  <span>$125.00</span>
                </div>
              )}
              {q.quoteRequest?.junkSameDay && (
                <div className="flex justify-between text-xs text-slate-500 pl-4">
                  <span>Same-Day Service</span>
                  <span>$50.00</span>
                </div>
              )}
              {q.quoteRequest?.junkHazardousItems && (
                <div className="flex justify-between text-xs text-slate-500 pl-4">
                  <span>Hazardous Items</span>
                  <span>$125.00</span>
                </div>
              )}
              <div className="border-t border-dashed border-slate-200 pt-3 flex justify-between">
                <span className="font-bold text-slate-800">Estimated Total</span>
                <span className="font-bold text-xl text-orange-600">{fmt(q.totalEstimate)}</span>
              </div>
            </div>
            <div className="bg-orange-500/5 px-6 py-4 border-t border-orange-500/10">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">Deposit Due Today</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(q.totalEstimate ?? 0) < 1000
                      ? "Flat $50 deposit to reserve"
                      : "50% deposit required to reserve"}
                  </p>
                </div>
                <span className="font-bold text-2xl text-orange-600">{fmt(q.depositAmount)}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
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
              {(q.pianoSurcharge ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Piano Moving Fee</span>
                  <span className="font-semibold text-slate-800">{fmt(q.pianoSurcharge)}</span>
                </div>
              )}
              {(q.commercialAdjustment ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-500" /> Commercial Rate Adjustment
                  </span>
                  <span className="font-semibold text-slate-800">{fmt(q.commercialAdjustment)}</span>
                </div>
              )}
              {isCommercialResult && (
                <div className="text-xs text-slate-400 bg-blue-50 rounded-lg px-3 py-2 mt-1">
                  Commercial pricing uses the greater of 2× the residential baseline or the space-size minimum (Small $1k · Medium $3k · Large $6k · Enterprise $10k).
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
        </>
      )}

      {moveDate && (
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
          <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs text-slate-500 font-medium">{isJunkResult ? "Service Date" : "Your Move Date"}</p>
            <p className="font-bold text-slate-800">
              {new Date(moveDate + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" /> What's Included
          </h3>
        </div>
        <ul className="px-6 py-4 space-y-2.5">
          {(isJunkResult ? [
            "Professional licensed & insured crew",
            "All loading and hauling included",
            "Eco-friendly disposal — we recycle & donate when possible",
            "Same-day service available",
            "No hidden fees — price includes disposal costs",
          ] : [
            "Professional licensed & insured crew",
            "Stretch wrap for all furniture pieces",
            "Moving blankets and pad protection",
            "Full disassembly & reassembly of furniture",
            "Wardrobe boxes (complimentary use on move day)",
            "Gas, tolls, and truck fee included",
          ]).map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 text-sm mb-1">Important Notes</p>
            <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
              {isJunkResult ? (
                <>
                  <li>This is an estimate — final price may vary based on actual volume.</li>
                  <li>Minimum charge: $175 per job.</li>
                  <li>Hazardous materials may incur additional fees.</li>
                  <li>10% discount available for Seniors & Veterans.</li>
                </>
              ) : (
                <>
                  <li>This is an estimate — final price is based on actual time used.</li>
                  <li>Minimum charge applies (see crew size above).</li>
                  <li>Stairs, long carries, or parking issues may affect time.</li>
                  <li>10% discount available for Seniors & Veterans.</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onReserve}
          className={`flex-1 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2 ${
            isJunkResult ? "bg-orange-500 hover:bg-orange-600 shadow-orange-500/30" : "bg-primary hover:bg-primary/90 shadow-primary/30"
          }`}
        >
          {isJunkResult ? "Reserve Junk Removal" : "Reserve My Move"} <ArrowRight className="w-5 h-5" />
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

  // Service type
  const [serviceType, setServiceType] = useState<ServiceType>("moving");
  const isJunkRemoval = serviceType === "junk_removal";

  // Move type: residential or commercial (for moving only)
  const [isCommercial, setIsCommercial] = useState(false);
  const [commercialBusinessType, setCommercialBusinessType] = useState<string>("Office");
  const [commercialSizeTier, setCommercialSizeTier] = useState<"small" | "medium" | "large" | "enterprise">("small");

  // Junk removal state
  const [junkLoadSize, setJunkLoadSize] = useState<"small" | "medium" | "large" | "full_truck">("small");
  const [junkStairsFlights, setJunkStairsFlights] = useState(0);
  const [junkHeavyItemsCount, setJunkHeavyItemsCount] = useState(0);
  const [junkConstructionDebris, setJunkConstructionDebris] = useState(false);
  const [junkSameDay, setJunkSameDay] = useState(false);
  const [junkHazardousItems, setJunkHazardousItems] = useState(false);

  // Piano moving state
  const [pianoType, setPianoType] = useState<"none" | "upright" | "grand">("none");
  const [pianoFloor, setPianoFloor] = useState<"ground" | "stairs">("ground");

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
    const fieldsToValidate: (keyof Step1Values)[] = ["contactName", "phone", "email", "moveDate"];
    if (!isJunkRemoval) {
      fieldsToValidate.push("pickupAddress", "dropoffAddress");
    }
    const valid = await triggerStep1(fieldsToValidate);
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
    const basePayload = {
      contactName: step1Data.contactName,
      phone: step1Data.phone,
      email: step1Data.email,
      moveDate: step1Data.moveDate,
      arrivalTimeWindow: step1Data.arrivalTimeWindow || undefined,
      pickupAddress: step1Data.pickupAddress || "",
      dropoffAddress: step1Data.dropoffAddress || "",
      secondStop: step1Data.secondStop || undefined,
      storageNeeded: step1Data.storageNeeded,
      additionalNotes: step1Data.additionalNotes || undefined,
      originAddress: step1Data.pickupAddress || "",
      destinationAddress: step1Data.dropoffAddress || "",
      moveType: "local" as const,
    };

    const payload = isJunkRemoval
      ? {
          ...basePayload,
          serviceType: "junk_removal" as const,
          junkLoadSize: junkLoadSize as "small" | "medium" | "large" | "full_truck",
          junkStairsFlights: junkStairsFlights,
          junkHeavyItemsCount: junkHeavyItemsCount,
          junkConstructionDebris: junkConstructionDebris,
          junkSameDay: junkSameDay,
          junkHazardousItems: junkHazardousItems,
        }
      : {
          ...basePayload,
          serviceType: "moving" as const,
          residentialOrCommercial: isCommercial ? "commercial" : "residential",
          isCommercial,
          commercialBusinessType: isCommercial ? commercialBusinessType : undefined,
          commercialSizeTier: isCommercial ? commercialSizeTier as "small" | "medium" | "large" | "enterprise" : undefined,
          numberOfBedrooms: homeSize.numberOfBedrooms,
          numberOfLivingRooms: homeSize.numberOfLivingRooms,
          isFullyFurnished: homeSize.isFullyFurnished,
          hasGarage: homeSize.hasGarage,
          hasOutdoorFurniture: homeSize.hasOutdoorFurniture,
          hasStairs: homeSize.hasStairs,
          hasHeavyItems: homeSize.hasHeavyItems,
          inventory,
          pianoType: pianoType !== "none" ? pianoType : undefined,
          pianoFloor: pianoType !== "none" ? pianoFloor : undefined,
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
              {isJunkRemoval ? "Get Your Junk Removal Quote" : "Get Your Moving Quote"}
            </h1>
            <p className="text-slate-500 text-lg">
              {isJunkRemoval
                ? "Select your load size and add-ons — get an instant price."
                : "Answer a few questions and get an exact price — takes under 3 minutes."}
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
                <ProgressBar
                currentStep={step}
                stepLabels={isJunkRemoval ? STEP_LABELS_JUNK : isCommercial ? STEP_LABELS_COMMERCIAL : STEP_LABELS_RESIDENTIAL}
              />

                <AnimatePresence mode="wait">

                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.25 }}
                    >
                      <StepHeader step={1} title={isJunkRemoval ? "Junk Removal Details" : "Move Details"} />
                      <div className="space-y-6">

                        {/* Service Type Selector */}
                        <div>
                          <label className={labelCls()}>Service Type</label>
                          <div className="grid grid-cols-3 gap-3">
                            <button
                              type="button"
                              onClick={() => { setServiceType("moving"); setIsCommercial(false); }}
                              className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                                !isJunkRemoval && !isCommercial
                                  ? "border-primary bg-green-50 text-primary shadow-sm"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              <Home className="w-5 h-5" />
                              <span>Residential</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setServiceType("moving"); setIsCommercial(true); }}
                              className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                                !isJunkRemoval && isCommercial
                                  ? "border-primary bg-green-50 text-primary shadow-sm"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              <Building2 className="w-5 h-5" />
                              <span>Commercial</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setServiceType("junk_removal"); setIsCommercial(false); }}
                              className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                                isJunkRemoval
                                  ? "border-orange-500 bg-orange-50 text-orange-600 shadow-sm"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              <Trash2 className="w-5 h-5" />
                              <span>Junk Removal</span>
                            </button>
                          </div>
                          {!isJunkRemoval && isCommercial && (
                            <p className="text-xs text-primary font-medium mt-2 flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5" /> Commercial pricing applies — minimums start at $1,000
                            </p>
                          )}
                          {isJunkRemoval && (
                            <p className="text-xs text-orange-600 font-medium mt-2 flex items-center gap-1">
                              <Trash2 className="w-3.5 h-3.5" /> Minimum job price: $175 — select load size on the next step
                            </p>
                          )}
                        </div>

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

                        {!isJunkRemoval && (
                          <>
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
                          </>
                        )}

                        {isJunkRemoval && (
                          <div>
                            <label className={labelCls()}>
                              Pickup Address <span className="text-slate-400 font-normal">(where to pick up junk)</span>
                            </label>
                            <input
                              {...register("pickupAddress")}
                              placeholder="123 Ocean Ave, Long Beach, NY 11561"
                              className={inputCls()}
                            />
                          </div>
                        )}

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
                            {isJunkRemoval ? "Next: Load Size" : isCommercial ? "Next: Business Details" : "Next: Home Size"} <ArrowRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && isJunkRemoval && (
                    <motion.div
                      key="step2junk"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.25 }}
                    >
                      <StepHeader step={2} title="Load Size & Add-ons" />
                      <div className="space-y-6">

                        <div>
                          <label className={labelCls()}>How much junk do you have?</label>
                          <div className="grid grid-cols-2 gap-3">
                            {JUNK_LOAD_SIZES.map((size) => (
                              <button
                                key={size.value}
                                type="button"
                                onClick={() => setJunkLoadSize(size.value)}
                                className={`flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-all ${
                                  junkLoadSize === size.value
                                    ? "border-orange-500 bg-orange-50 shadow-sm"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                }`}
                              >
                                <span className="text-2xl">{size.icon}</span>
                                <span className={`font-bold text-sm ${junkLoadSize === size.value ? "text-orange-600" : "text-slate-700"}`}>
                                  {size.label}
                                </span>
                                <span className="text-xs text-slate-500">{size.description}</span>
                                <span className={`text-xs font-semibold mt-1 ${junkLoadSize === size.value ? "text-orange-600" : "text-slate-600"}`}>
                                  {size.range}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className={labelCls()}>Add-ons</label>
                          <div className="space-y-3">
                            {JUNK_ADDONS.map((addon) => (
                              <div
                                key={addon.key}
                                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                  addon.key === "stairs" ? (junkStairsFlights > 0 ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-white") :
                                  addon.key === "heavy" ? (junkHeavyItemsCount > 0 ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-white") :
                                  addon.key === "debris" ? (junkConstructionDebris ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-white") :
                                  addon.key === "sameDay" ? (junkSameDay ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-white") :
                                  addon.key === "hazard" ? (junkHazardousItems ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-white") :
                                  "border-slate-200 bg-white"
                                }`}
                              >
                                <div>
                                  <p className="font-semibold text-sm text-slate-800">{addon.label}</p>
                                  <p className="text-xs text-slate-500">{addon.description}</p>
                                </div>
                                {addon.perUnit ? (
                                  <CounterButton
                                    value={addon.key === "stairs" ? junkStairsFlights : junkHeavyItemsCount}
                                    onChange={addon.key === "stairs" ? setJunkStairsFlights : setJunkHeavyItemsCount}
                                    max={addon.key === "stairs" ? 10 : 20}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (addon.key === "debris") setJunkConstructionDebris((v) => !v);
                                      if (addon.key === "sameDay") setJunkSameDay((v) => !v);
                                      if (addon.key === "hazard") setJunkHazardousItems((v) => !v);
                                    }}
                                    className={`w-12 h-7 rounded-full transition-colors relative ${
                                      (addon.key === "debris" && junkConstructionDebris) ||
                                      (addon.key === "sameDay" && junkSameDay) ||
                                      (addon.key === "hazard" && junkHazardousItems)
                                        ? "bg-orange-500"
                                        : "bg-slate-300"
                                    }`}
                                  >
                                    <span
                                      className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                                        (addon.key === "debris" && junkConstructionDebris) ||
                                        (addon.key === "sameDay" && junkSameDay) ||
                                        (addon.key === "hazard" && junkHazardousItems)
                                          ? "translate-x-5"
                                          : "translate-x-0.5"
                                      }`}
                                    />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <Trash2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-orange-900 text-sm mb-1">Junk Removal Info</p>
                              <ul className="text-xs text-orange-800 space-y-1 list-disc list-inside">
                                <li>Minimum job price: $175</li>
                                <li>We handle all loading, hauling, and disposal</li>
                                <li>Eco-friendly disposal — we recycle & donate when possible</li>
                                <li>Flat $50 deposit for jobs under $1,000; 50% for $1,000+</li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between pt-2">
                          <button type="button" onClick={() => goToStep(1)} className="flex items-center gap-2 text-slate-500 font-semibold px-4 py-3 hover:bg-slate-100 rounded-xl transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Back
                          </button>
                          <button
                            type="button"
                            onClick={handleFinalSubmit}
                            disabled={mutation.isPending}
                            className="bg-orange-500 text-white px-8 py-4 rounded-xl font-bold hover:bg-orange-600 flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-60"
                          >
                            {mutation.isPending ? (
                              <><Loader2 className="w-5 h-5 animate-spin" /> Calculating...</>
                            ) : (
                              <>Get My Junk Removal Quote <ArrowRight className="w-5 h-5" /></>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && !isJunkRemoval && isCommercial && !isJunkRemoval && (
                    <motion.div
                      key="step2commercial"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.25 }}
                    >
                      <StepHeader step={2} title="Business Details" />
                      <div className="space-y-6">

                        {/* Business Type */}
                        <div>
                          <label className={labelCls()}>Type of Business</label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {COMMERCIAL_BUSINESS_TYPES.map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setCommercialBusinessType(type)}
                                className={`py-3 px-3 rounded-xl text-xs font-semibold border-2 transition-all text-center ${
                                  commercialBusinessType === type
                                    ? "border-primary bg-green-50 text-primary shadow-sm"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                }`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Size Tier */}
                        <div>
                          <label className={labelCls()}>Space / Office Size</label>
                          <p className="text-xs text-slate-500 mb-3">Select the size that best describes your space.</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {COMMERCIAL_SIZE_TIERS.map((tier) => (
                              <button
                                key={tier.value}
                                type="button"
                                onClick={() => setCommercialSizeTier(tier.value)}
                                className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                                  commercialSizeTier === tier.value
                                    ? "border-primary bg-green-50 shadow-sm"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                }`}
                              >
                                <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  commercialSizeTier === tier.value ? "border-primary bg-primary" : "border-slate-300"
                                }`}>
                                  {commercialSizeTier === tier.value && <span className="w-2 h-2 rounded-full bg-white" />}
                                </span>
                                <span>
                                  <span className={`font-bold text-sm ${commercialSizeTier === tier.value ? "text-primary" : "text-slate-700"}`}>
                                    {tier.label}
                                  </span>
                                  <span className="block text-xs text-slate-500 mt-0.5">{tier.sqft}</span>
                                  <span className="block text-xs text-slate-400 mt-0.5">{tier.example}</span>
                                  <span className={`block text-xs font-semibold mt-1 ${commercialSizeTier === tier.value ? "text-primary" : "text-slate-600"}`}>
                                    From {tier.min}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Commercial info box */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-blue-900 text-sm mb-1">Commercial Move Pricing</p>
                              <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                                <li>Rates are 2× residential baseline or the tier minimum, whichever is greater.</li>
                                <li>COI (Certificate of Insurance) available upon request.</li>
                                <li>After-hours and weekend moves available for businesses.</li>
                                <li>Call us to discuss large or complex commercial moves.</li>
                              </ul>
                            </div>
                          </div>
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

                  {step === 2 && !isJunkRemoval && !isCommercial && (
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
                            description="Safe, pool table, large appliances"
                          />
                        </div>

                        {/* Piano question */}
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm mb-1">Moving a Piano?</p>
                            <p className="text-xs text-slate-500">Piano moves require specialized handling — flat surcharge applies.</p>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { value: "none" as const, label: "No Piano" },
                              { value: "upright" as const, label: "Upright" },
                              { value: "grand" as const, label: "Grand" },
                            ]).map(({ value, label }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setPianoType(value)}
                                className={`py-3 px-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                                  pianoType === value
                                    ? "border-primary bg-green-50 text-primary shadow-sm"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {pianoType !== "none" && (
                            <div>
                              <p className="text-xs font-medium text-slate-600 mb-2">Floor access for the piano:</p>
                              <div className="grid grid-cols-2 gap-2">
                                {([
                                  { value: "ground" as const, label: "Ground Level", price: pianoType === "upright" ? "$350" : "$800" },
                                  { value: "stairs" as const, label: "Stairs", price: pianoType === "upright" ? "$500" : "$800" },
                                ]).map(({ value, label, price }) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => setPianoFloor(value)}
                                    className={`py-3 px-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                                      pianoFloor === value
                                        ? "border-primary bg-green-50 text-primary shadow-sm"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                    }`}
                                  >
                                    {label}
                                    <span className="block text-xs font-normal mt-0.5 opacity-70">{price} surcharge</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
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

                  {step === 3 && !isJunkRemoval && (
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
                        {(isCommercial ? COMMERCIAL_INVENTORY_CATEGORIES : INVENTORY_CATEGORIES).map((cat) => {
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

                  {step === 4 && !isJunkRemoval && (
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
