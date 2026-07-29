"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const videoRef = useRef(null);
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.error("Video autoplay failed:", err);
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid credentials");
      if (data.user) setUser(data.user);
      router.push("/dashboard");
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Full-Screen Background Video */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover z-0 scale-105 blur-[2px]"
        onError={(e) => {
          console.error("Video failed to load:", e);
        }}
      >
        <source src="/video/ship.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-slate-900/45 z-[1]" />

      {/* Watermark cover - hides the "Veo" text */}
      <div
        className="absolute bottom-0 right-0 z-[2]"
        style={{
          width: "100px",
          height: "44px",
          background:
            "linear-gradient(145deg, rgba(25,65,75,0.9) 0%, rgba(18,55,65,1) 40%, rgba(12,45,55,1) 100%)",
        }}
      />

      {/* Glass Card - Logo + Form */}
      <div className="relative z-10 w-full max-w-[920px] mx-4 flex flex-col md:flex-row rounded-2xl overflow-hidden border border-white/25 shadow-[0_25px_60px_rgba(0,0,0,0.45)] bg-white/10 backdrop-blur-xl">
        {/* Left Side - Logo only */}
        <div className="w-full md:w-1/2 flex items-center justify-center px-8 py-10 md:px-10 md:py-14 min-h-[240px] md:min-h-[440px]">
          <Image
            src="/image/image.png"
            alt="Helios Logo"
            width={340}
            height={200}
            unoptimized
            className="object-contain w-full max-w-[220px] sm:max-w-[280px] md:max-w-[320px] h-auto drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            priority
          />
        </div>

        {/* Divider */}
        <div className="h-px md:h-auto md:w-px bg-white/35 mx-8 md:mx-0 md:my-10 shrink-0" />

        {/* Right Side - Login Form */}
        <div className="w-full md:w-1/2 flex flex-col justify-between p-8 sm:p-10 md:py-12 md:px-10">
          <div>
            <h1 className="text-2xl sm:text-[1.75rem] font-bold text-white tracking-tight mb-6 sm:mb-8">
              Helios
            </h1>

            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-bold text-white">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/55 border border-white/15 text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500/50 transition-all"
                  placeholder="Enter your email"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-bold text-white">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-lg bg-slate-900/55 border border-white/15 text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500/50 transition-all"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-orange-500 hover:text-orange-400 focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg shadow-orange-500/35 transition-all duration-200 hover:shadow-xl hover:shadow-orange-500/45 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-white/55 text-xs sm:text-sm">
            ©2025 Helios Tech Labs. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
