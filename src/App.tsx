import { lazy, Suspense, useEffect, useState } from 'react';
import { i18next } from './i18n';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './app/session';
import { Layout } from './components/Layout';
import { CalendarPage } from './pages/CalendarPage';
import { CsvImportPage } from './pages/CsvImportPage';
import { IssueFormPage } from './pages/IssueFormPage';
import { IssuesPage } from './pages/IssuesPage';
import { LoginPage } from './pages/LoginPage';
import { MonitorPage } from './pages/MonitorPage';
import { HomePage } from './pages/DashboardPage';
import { LabelsPage } from './pages/LabelsPage';
import { LogEntryPage } from './pages/LogEntryPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProductPage } from './pages/ProductPage';
import { ProductsPage } from './pages/ProductsPage';
import { ReportPage } from './pages/ReportPage';
import { ScanPage } from './pages/ScanPage';
import { SettingsPage } from './pages/SettingsPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { TagEditPage } from './pages/TagEditPage';
import { TagPage } from './pages/TagPage';
import { TagsPage } from './pages/TagsPage';

// The PDF viewer (pdf.js, ~1 MB) is only loaded when a document is opened.
const PdfViewerPage = lazy(() => import('./pages/PdfViewerPage').then((m) => ({ default: m.PdfViewerPage })));

// Hash routing (#/t/<uuid>) works on any static hosting such as GitHub Pages.
export function App() {
  // switching the language rebuilds the UI once, so every text is shown in the new language
  const [lang, setLang] = useState(i18next.language);
  useEffect(() => {
    const on = (l: string) => setLang(l);
    i18next.on('languageChanged', on);
    return () => i18next.off('languageChanged', on);
  }, []);
  return (
    <HashRouter key={lang}>
      <SessionProvider>
        <Routes>
          <Route
            path="viewer"
            element={
              <Suspense
                fallback={
                  <div className="pdfv">
                    <div className="pdfv-msg">Viewer wird geladen …</div>
                  </div>
                }
              >
                <PdfViewerPage />
              </Suspense>
            }
          />
          <Route path="monitor" element={<MonitorPage />} />
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="scan" element={<ScanPage />} />
            <Route path="t/:id" element={<TagPage />} />
            <Route path="t/:id/eintrag" element={<LogEntryPage />} />
            <Route path="t/:id/meldung" element={<IssueFormPage />} />
            <Route path="meldungen" element={<IssuesPage />} />
            <Route path="anmelden" element={<LoginPage />} />
            <Route path="hinweise" element={<NotificationsPage />} />
            <Route path="tags" element={<TagsPage />} />
            <Route path="tags/neu" element={<TagEditPage />} />
            <Route path="tags/:id/bearbeiten" element={<TagEditPage />} />
            <Route path="katalog" element={<ProductsPage />} />
            <Route path="katalog/:id" element={<ProductPage />} />
            <Route path="lieferanten" element={<SuppliersPage />} />
            <Route path="etiketten" element={<LabelsPage />} />
            <Route path="import" element={<CsvImportPage />} />
            <Route path="report" element={<ReportPage />} />
            <Route path="kalender" element={<CalendarPage />} />
            <Route path="einstellungen" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </SessionProvider>
    </HashRouter>
  );
}
