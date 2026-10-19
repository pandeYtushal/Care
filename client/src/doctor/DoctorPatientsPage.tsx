import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { rowSortingFeature, tableFeatures, useTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowDownUp, RefreshCw, Search } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

type PatientRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  appointment_count: number;
  last_appointment: string | null;
};
type DirectoryResult = { patients: PatientRow[]; total: number; page: number; pageSize: number };
const patientDirectoryFeatures = tableFeatures({ rowSortingFeature });

function dateLabel(value: string | null): string {
  if (!value) return "No visit recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export default function DoctorPatientsPage() {
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<DirectoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([{ id: "last_appointment", desc: true }]);

  const columns = useMemo<ColumnDef<typeof patientDirectoryFeatures, PatientRow>[]>(() => {
    const sortable = (id: keyof PatientRow, label: string): ColumnDef<typeof patientDirectoryFeatures, PatientRow> => ({
      accessorKey: id,
      header: ({ column }) => {
        const direction = column.getIsSorted();
        return <button className="directory-sort" type="button" onClick={column.getToggleSortingHandler()} aria-label={`Sort by ${label}`}>
          {label}{direction ? <ArrowDown size={14} aria-hidden="true" className={direction === "asc" ? "directory-sort-ascending" : ""} /> : <ArrowDownUp size={14} aria-hidden="true" />}
        </button>;
      },
    });
    return [
      { ...sortable("full_name", "Patient"), cell: ({ row, getValue }) => <Link to={`/doctor/patients/${row.original.id}`}>{getValue<string>()}</Link> },
      sortable("email", "Email"),
      sortable("phone", "Phone"),
      sortable("appointment_count", "Appointments"),
      { ...sortable("last_appointment", "Last visit"), cell: ({ getValue }) => dateLabel(getValue<string | null>()) },
      { id: "chart", enableSorting: false, header: () => <span className="sr-only">Patient chart</span>, cell: ({ row }) => <Link className="patient-record-link" to={`/doctor/patients/${row.original.id}`}>Open chart</Link> },
    ];
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSubmittedSearch(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const selectedSort = sorting[0] ?? { id: "last_appointment", desc: true };
    const params = new URLSearchParams({ search: submittedSearch, page: String(page), sort: selectedSort.id, order: selectedSort.desc ? "desc" : "asc" });
    api<DirectoryResult>(`/portal/patient-directory?${params.toString()}`)
      .then((response) => { if (alive) setResult(response); })
      .catch((reason: unknown) => {
        if (!alive) return;
        setError(reason instanceof ApiError ? reason.message : "Could not load patient records. Check your connection and retry.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [page, reload, sorting, submittedSearch]);

  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.pageSize ?? 25)));
  const patients = result?.patients ?? [];
  const table = useTable({
    features: patientDirectoryFeatures,
    data: patients,
    columns,
    state: { sorting },
    onSortingChange: (update) => {
      setSorting(update);
      setPage(1);
    },
    manualSorting: true,
  });
  const sortedPatients = table.getRowModel().rows.map((row) => row.original);

  return (
    <main className="portal-content doctor-patients-page">
      <div className="eyebrow">PATIENT CARE</div>
      <div className="doctor-patients-heading">
        <div><h1>Patients</h1><p className="page-subtitle">Patients with appointments at your practice.</p></div>
        {result && <span className="doctor-patient-total" aria-live="polite">{result.total} {result.total === 1 ? "patient" : "patients"}</span>}
      </div>
      <section className="doctor-patient-directory" aria-label="Patient directory">
        <div className="doctor-patient-toolbar">
          <label className="doctor-patient-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search by patient name, email, or phone</span>
            <Input type="search" maxLength={120} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or phone" />
          </label>
          <label className="doctor-patient-sort"><span>Sort patients</span>
            <Select aria-label="Sort patient records" value={`${sorting[0]?.id ?? "last_appointment"}:${sorting[0]?.desc ? "desc" : "asc"}`} onChange={(event) => {
              const [id, direction] = event.target.value.split(":");
              setSorting([{ id, desc: direction === "desc" }]);
              setPage(1);
            }}>
              <option value="last_appointment:desc">Latest visit first</option>
              <option value="last_appointment:asc">Oldest visit first</option>
              <option value="full_name:asc">Name A to Z</option>
              <option value="full_name:desc">Name Z to A</option>
              <option value="appointment_count:desc">Most appointments</option>
              <option value="appointment_count:asc">Fewest appointments</option>
              <option value="email:asc">Email A to Z</option>
              <option value="phone:asc">Phone A to Z</option>
            </Select>
          </label>
        </div>

        {error ? <div className="doctor-patient-state error" role="alert"><p>{error}</p><Button variant="secondary" onClick={() => setReload((value) => value + 1)}><RefreshCw size={15} /> Try again</Button></div>
          : loading ? <div className="doctor-patient-state" role="status">Loading patient records…</div>
            : patients.length === 0 ? <div className="doctor-patient-state"><h2>{submittedSearch ? "No matching patients" : "No patient records yet"}</h2><p>{submittedSearch ? "Try another name, email, or phone number." : "Patients with appointments at your practice will appear here."}</p></div>
              : <>
                <div className="doctor-patient-table-wrap">
                  <table className="data-table doctor-patient-table" aria-label="Patient directory sorted on the server">
                    <thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} aria-sort={header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : "none"}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</th>)}</tr>)}</thead>
                    <tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getAllCells().map((cell) => <td data-label={cell.column.id.replaceAll("_", " ")} key={cell.id}><table.FlexRender cell={cell} /></td>)}</tr>)}</tbody>
                  </table>
                </div>
                <div className="doctor-patient-cards">
                  {sortedPatients.map((patient) => <article className="doctor-patient-card" key={patient.id}>
                    <div className="doctor-patient-card-head"><div><span className="eyebrow">PATIENT</span><h2>{patient.full_name}</h2></div><Link to={`/doctor/patients/${patient.id}`} className="btn btn-secondary">Open chart</Link></div>
                    <dl><div><dt>Email</dt><dd>{patient.email || "—"}</dd></div><div><dt>Phone</dt><dd>{patient.phone || "—"}</dd></div><div><dt>Appointments</dt><dd>{patient.appointment_count}</dd></div><div><dt>Last visit</dt><dd>{dateLabel(patient.last_appointment)}</dd></div></dl>
                  </article>)}
                </div>
                <nav className="doctor-patient-pagination" aria-label="Patient directory pages">
                  <span>Page {page} of {totalPages}</span>
                  <div><Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><Button variant="secondary" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button></div>
                </nav>
              </>}
      </section>
    </main>
  );
}
