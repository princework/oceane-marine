"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [formData, setFormData] = useState({
    employeeId: "",
    employeeName: "",
    email: "",
    password: "",
    confirmPassword: "",
    /** Legacy User.roles; module roles come from signup API (viewer, or all admin if ADMIN). */
    role: "REVIEWER",
  });

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
   const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      setIsLoading(false);
      return;
    }

    const payload = { ...formData };
    delete payload.confirmPassword;

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to create account");
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 700);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return <div>Account created successfully. Please login.</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background with blur */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url(https://res.cloudinary.com/dpu6rveug/image/upload/v1765346760/ocean-group-background_bzbnm3.webp)",
        }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      </div>

      {/* Signup Form */}
      <div className="relative z-10 w-full max-w-lg px-4 sm:px-6 py-6 sm:py-10">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl p-5 sm:p-8">
          <div className="text-center mb-5 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
              Create Account
            </h1>
            <p className="text-white/70 text-xs sm:text-sm">
              Register your Oceans Marine account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Error */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Employee Name */}
            <InputField
              label="Full Name"
              name="employeeName"
              value={formData.employeeName}
              onChange={handleChange}
              placeholder="Enter full name"
            />

            {/* Employee ID */}
            <InputField
              label="Employee ID"
              name="employeeId"
              value={formData.employeeId}
              onChange={handleChange}
              placeholder="OFD-001"
            />

            {/* Email */}
            <InputField
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter email"
            />

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-white/90">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-white/10 border border-white/20 
        text-white placeholder-white/50 focus:outline-none focus:ring-2 
        focus:ring-orange-500/50 transition-all"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-orange-500 focus:outline-none"
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

            {/* Confirm password */}
            <div className="space-y-2">
              <label
                htmlFor="signup-confirm-password"
                className="block text-sm font-semibold text-white/90"
              >
                Confirm password
              </label>
              <input
                id="signup-confirm-password"
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 
        text-white placeholder-white/50 focus:outline-none focus:ring-2 
        focus:ring-orange-500/50 transition-all"
                placeholder="Re-enter password"
              />
            </div>

            {/* Role Dropdown — legacy User.roles + module roles from API */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-white/90">
                Application role
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              >
                <option value="REVIEWER">Reviewer (read / review)</option>
                <option value="EDITOR">Editor</option>
                <option value="UPLOADER">Uploader</option>
                <option value="CUSTOM_EDITOR">Custom Editor</option>
                <option value="ADMIN">Admin (Admin Panel + module admin)</option>
              </select>
              <p className="text-xs text-white/60">
                {formData.role === "ADMIN"
                  ? "Admin: legacy ADMIN role plus Operations / HR / PMS / QHSE admin — full user management and module admin access."
                  : "Other roles: module access (Operations, HR, PMS, QHSE) starts as viewer; an Admin can raise it later from Admin Panel."}
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 sm:py-3 px-6 rounded-xl shadow-lg shadow-orange-500/40 transition-all text-sm sm:text-base"
            >
              {isLoading ? "Creating account..." : "Sign Up"}
            </button>

            <p className="text-center text-white/70 text-xs sm:text-sm mt-4">
              Already have an account?{" "}
              <a
                href="/login"
                className="text-orange-400 hover:text-orange-500"
              >
                Sign in
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

/*------------------------------
  InputField Component
-------------------------------*/
function InputField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
}) {
  return (
    <div className="space-y-1.5 sm:space-y-2">
      <label className="block text-xs sm:text-sm font-semibold text-white/90">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required
        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-white/10 border border-white/20 
        text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 
        focus:ring-orange-500/50 transition-all"
        placeholder={placeholder}
      />
    </div>
  );
}
