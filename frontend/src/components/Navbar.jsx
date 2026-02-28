import { FiSearch, FiBell, FiSettings } from "react-icons/fi";

export default function Navbar() {
  return (
    <header
      className="
        h-20 
        bg-white/40 backdrop-blur-2xl 
        border-b border-white/50
        flex items-center px-10 
        sticky top-0 z-20
        shadow-[0_5px_30px_rgba(0,0,0,0.03)]
      "
    >
      {/* Search */}
      <div className="flex-1 flex items-center">

      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-5">

        {/* Notification */}
        <button
          className="
            w-11 h-11 rounded-2xl 
            bg-white/60 backdrop-blur-xl
            border border-white shadow-sm
            flex items-center justify-center 
            text-slate-500 hover:text-blue-600 
            hover:shadow-md transition-all relative
          "
        >
          <FiBell className="text-lg" />
          <span className="absolute top-2.5 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        </button>





      </div>
    </header>
  );
}