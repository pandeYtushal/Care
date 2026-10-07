const fs = require('fs');
const path = require('path');

const filePath = path.resolve('c:/Users/tusha/OneDrive/Desktop/Doctor/client/src/pages/PortalPage.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split(/\r?\n/);

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('export function PortalLayout({ role }: { role: Role }) {')) {
    startIndex = i;
  }
  if (startIndex !== -1 && i > startIndex && lines[i] === '}' && lines[i-1] === '  );' && lines[i-2] === '    </div>') {
    endIndex = i;
    break;
  }
}

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find PortalLayout bounds");
  console.log("Start:", startIndex, "End:", endIndex);
  process.exit(1);
}

const newComponent = `export function PortalLayout({ role }: { role: Role }) {
  const { user, signOut } = useAuth();
  const path = useLocation().pathname;
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const doctor = role === "DOCTOR";
  const links = doctor ? doctorLinks : patientLinks;

  async function logout() {
    setLogoutError("");
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch {
      setLogoutError("Could not sign out.");
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex overflow-hidden font-sans selection:bg-white selection:text-black">
      {/* Sidebar */}
      <aside className={\`fixed inset-y-0 left-0 z-50 w-64 bg-black border-r border-white/10 transform transition-transform duration-300 ease-in-out flex flex-col \${menuOpen ? "translate-x-0" : "-translate-x-full"} lg:relative lg:translate-x-0\`}>
        <div className="h-20 flex items-center px-6 border-b border-white/10">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black">
               <HeartPulse size={16} strokeWidth={2.5} />
             </div>
             <span className="font-bold tracking-tight text-lg">Kiran</span>
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-8 px-4">
           <div className="text-xs font-bold text-white/40 tracking-widest mb-4 px-2 uppercase">Menu</div>
           <nav className="space-y-1.5">
             {links.map((link) => {
               const active = link.exact ? path === link.to : path.startsWith(link.to);
               return (
                 <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className={\`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 \${active ? 'bg-white text-black' : 'text-white/50 hover:text-white hover:bg-white/5'}\`}>
                   <link.icon size={18} />
                   {link.title}
                 </Link>
               );
             })}
           </nav>
        </div>
        
        <div className="p-4 border-t border-white/10 space-y-2">
          {logoutError && <p className="text-xs text-red-400 px-2">{logoutError}</p>}
          <Link to={\`/\${doctor ? 'doctor' : 'patient'}/profile\`} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-sm font-bold text-white">
              {(user?.fullName ?? user?.email ?? 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user?.fullName ?? user?.email}</div>
              <div className="text-xs text-white/50 truncate">{doctor ? 'Clinician' : 'Patient'}</div>
            </div>
          </Link>
          <button onClick={() => void logout()} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold text-white/50 hover:text-white hover:bg-white/10 transition-all mt-2">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      
      {/* Mobile Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMenuOpen(false)} />
      )}
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-20 flex items-center justify-between px-6 lg:px-10 border-b border-white/10 shrink-0">
           <div className="flex items-center gap-4">
             <button className="lg:hidden text-white/70 hover:text-white" onClick={() => setMenuOpen(true)}>
               <Menu size={24} />
             </button>
             <h1 className="text-xl font-bold tracking-tighter hidden sm:block">
               {doctor ? 'Clinical Workspace' : 'Patient Portal'}
             </h1>
           </div>
           
           <div className="flex items-center gap-4">
              <Link to={\`/\${doctor ? 'doctor' : 'patient'}/notifications\`} className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-white/30 transition-all bg-white/5">
                <Bell size={18} />
              </Link>
           </div>
        </header>
        
        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-auto p-6 lg:p-10 relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}`;

lines.splice(startIndex, endIndex - startIndex + 1, newComponent);

fs.writeFileSync(filePath, lines.join('\\n'), 'utf8');
console.log("Replaced PortalLayout successfully!");
