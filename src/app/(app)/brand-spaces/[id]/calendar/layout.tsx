// The calendar page, plus a slot where a post opens as a panel over it. A direct link still opens the post as a full page.
export default function CalendarLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
