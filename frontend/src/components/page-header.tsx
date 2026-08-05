import Link from "next/link";

type PageHeaderProps = {
  title: string;
  backHref?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, backHref = "/", action }: PageHeaderProps) {
  return (
    <header className="page-header">
      <Link className="icon-button" href={backHref} aria-label="뒤로 가기">
        <span className="back-glyph" aria-hidden="true" />
      </Link>
      <h1>{title}</h1>
      <div className="page-header__action">{action}</div>
    </header>
  );
}
