export default function WorkbenchView({ blueprint, stage }) {
  return (
    <section className="workbench grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="panel blueprint">{blueprint}</div>
      <div className="panel stage">{stage}</div>
    </section>
  )
}
