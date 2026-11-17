import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './app/session';
import { Layout } from './components/Layout';
import { CsvImportPage } from './pages/CsvImportPage';
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

// Hash routing (#/t/<uuid>) works on any static hosting such as GitHub Pages.
export function App() {
  return (
    <HashRouter>
      <SessionProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<ScanPage />} />
            <Route path="t/:id" element={<TagPage />} />
            <Route path="t/:id/eintrag" element={<LogEntryPage />} />
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
            <Route path="einstellungen" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </SessionProvider>
    </HashRouter>
  );
}
