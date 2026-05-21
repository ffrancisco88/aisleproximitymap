import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { MapPin, Radio, ShoppingBag, Cpu, ArrowRight } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Nav */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/70 border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2" data-testid="brand-mark">
            <div className="w-7 h-7 rounded-md bg-zinc-900 grid place-items-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-zinc-900 tracking-tight">ProximityMap AI</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin"><Button variant="ghost" data-testid="nav-admin">Admin</Button></Link>
            <Link to="/customer"><Button data-testid="nav-customer">Open Customer App <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-12 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 font-bold mb-4">ESP32-S3 · BLE + Wi-Fi Hybrid</p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 leading-[1.05]">
            Guide shoppers<br />
            to <span className="text-[#0055FF]">every aisle</span><br />
            in real-time.
          </h1>
          <p className="text-zinc-600 mt-6 max-w-md text-base leading-relaxed">
            Upload a floor plan, drop four ESP32-S3 beacons, and let your customers see a live "you are here" dot, find products, and get hit with proximity promos — all running locally on your Windows 10 PC.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/admin/setup"><Button size="lg" className="bg-zinc-900 hover:bg-zinc-800" data-testid="cta-setup">Windows 10 Setup Guide</Button></Link>
            <Link to="/customer"><Button size="lg" variant="outline" data-testid="cta-customer">Try Customer App</Button></Link>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative aspect-[4/3] rounded-2xl border border-zinc-200 bg-white shadow-xl overflow-hidden"
        >
          <div className="absolute inset-0 map-grid opacity-60" />
          {/* fake aisles */}
          <div className="absolute left-[8%] top-[18%] w-[36%] h-[18%] rounded-md border-2 border-dashed border-[#0055FF]/40 bg-[#0055FF]/10" />
          <div className="absolute left-[8%] top-[44%] w-[36%] h-[18%] rounded-md border-2 border-dashed border-[#0055FF]/40 bg-[#0055FF]/10" />
          <div className="absolute right-[10%] top-[18%] w-[36%] h-[44%] rounded-md border-2 border-dashed border-[#0055FF]/40 bg-[#0055FF]/10" />
          {/* beacons */}
          {[[12,12],[88,12],[88,88],[12,88]].map(([x,y],i)=>(
            <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{left:`${x}%`,top:`${y}%`}}>
              <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white beacon-pulse"/>
            </div>
          ))}
          {/* user dot */}
          <div className="absolute -translate-x-1/2 -translate-y-1/2 user-dot w-4 h-4 rounded-full bg-blue-600 border-2 border-white" style={{left:'30%',top:'60%'}}/>
          {/* route */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <polyline className="route-path" points="30,60 30,28 65,28" fill="none" stroke="#0055FF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <polygon transform="translate(65,28) rotate(0)" points="-2.5,-1.6 0,0 -2.5,1.6" fill="#0055FF"/>
          </svg>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Cpu, title: "4× ESP32-S3 Beacons", desc: "BLE iBeacon + Wi-Fi SoftAP advertising. Arduino sketch included." },
            { icon: Radio, title: "Hybrid Positioning", desc: "Weighted RSSI multilateration fuses BLE and Wi-Fi for ~2-3m accuracy." },
            { icon: ShoppingBag, title: "Proximity Promos", desc: "Trigger product info + discounts when a shopper steps near a shelf." },
          ].map((f, i) => (
            <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 hover:shadow-md transition-shadow" data-testid={`feature-${i}`}>
              <f.icon className="w-6 h-6 text-[#0055FF] mb-4" />
              <h3 className="font-semibold text-zinc-900 text-lg">{f.title}</h3>
              <p className="text-zinc-600 text-sm mt-2 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-200 py-8 text-center text-xs text-zinc-500">
        Built for local Windows 10 deployment · ESP32-S3 ready
      </footer>
    </div>
  );
}
