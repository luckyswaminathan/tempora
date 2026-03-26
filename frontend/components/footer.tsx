export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-background/70 backdrop-blur-sm">
      <div className="container mx-auto flex flex-col gap-2 px-4 py-7 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>© {year} tempora. All rights reserved.</p>
        <a
          href="https://github.com/luckyswaminathan/tempora"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-primary"
          aria-label="Open GitHub repository"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
