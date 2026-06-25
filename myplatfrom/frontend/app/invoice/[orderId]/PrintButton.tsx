'use client'
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors"
    >
      พิมพ์ / บันทึก PDF
    </button>
  )
}
