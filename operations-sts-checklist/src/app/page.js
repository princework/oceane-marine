'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FORMS, FORM_TITLES } from '@/lib/config';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-6">
          <div className="relative w-48 h-20">
            <Image
              src="/image/logo.png"
              alt="OCEANE GROUP - SHIP-TO-SHIP TRANSFER"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="flex-1 flex flex-col items-center text-center">
            <h1 className="text-3xl font-bold mb-2">
              STS CHECKLIST MANAGEMENT
            </h1>
            <p className="text-gray-400">Operations Forms Dashboard</p>
          </div>
        </div>

        {/* Forms table */}
        <div className="rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="text-left py-3 px-4 font-semibold">Form Number</th>
                <th className="text-left py-3 px-4 font-semibold">Form Title</th>
                <th className="text-left py-3 px-4 font-semibold w-32">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {FORMS.map((form) => (
                <tr key={form.path} className="hover:bg-gray-800/50">
                  <td className="py-3 px-4">{form.formNo}</td>
                  <td className="py-3 px-4">
                    {FORM_TITLES[form.path] ?? form.formNo}
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/${form.path}`}
                      className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition"
                    >
                      Open form
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}