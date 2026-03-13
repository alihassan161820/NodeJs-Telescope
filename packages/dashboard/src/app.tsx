import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/app-layout';
import { RequestsPage } from './pages/requests';
import { RequestDetailPage } from './pages/request-detail';
import { ExceptionsPage } from './pages/exceptions';
import { ExceptionDetailPage } from './pages/exception-detail';
import { QueriesPage } from './pages/queries';
import { QueryDetailPage } from './pages/query-detail';
import { LogsPage } from './pages/logs';
import { LogDetailPage } from './pages/log-detail';
import { ModelsPage } from './pages/models';
import { ModelDetailPage } from './pages/model-detail';
import { EventsPage } from './pages/events';
import { EventDetailPage } from './pages/event-detail';
import { JobsPage } from './pages/jobs';
import { JobDetailPage } from './pages/job-detail';
import { MailPage } from './pages/mail';
import { MailDetailPage } from './pages/mail-detail';
import { NotificationsPage } from './pages/notifications';
import { NotificationDetailPage } from './pages/notification-detail';
import { CachePage } from './pages/cache';
import { CacheDetailPage } from './pages/cache-detail';
import { RedisPage } from './pages/redis';
import { RedisDetailPage } from './pages/redis-detail';
import { GatesPage } from './pages/gates';
import { GateDetailPage } from './pages/gate-detail';
import { HttpClientPage } from './pages/http-client';
import { HttpClientDetailPage } from './pages/http-client-detail';
import { CommandsPage } from './pages/commands';
import { CommandDetailPage } from './pages/command-detail';
import { SchedulesPage } from './pages/schedules';
import { ScheduleDetailPage } from './pages/schedule-detail';
import { DumpsPage } from './pages/dumps';
import { DumpDetailPage } from './pages/dump-detail';
import { BatchesPage } from './pages/batches';
import { BatchDetailPage } from './pages/batch-detail';
import { ViewsPage } from './pages/views';
import { ViewDetailPage } from './pages/view-detail';

export function App() {
  return (
    <BrowserRouter basename="/__telescope">
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/requests" replace />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="requests/:id" element={<RequestDetailPage />} />
          <Route path="exceptions" element={<ExceptionsPage />} />
          <Route path="exceptions/:id" element={<ExceptionDetailPage />} />
          <Route path="queries" element={<QueriesPage />} />
          <Route path="queries/:id" element={<QueryDetailPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="logs/:id" element={<LogDetailPage />} />
          <Route path="models" element={<ModelsPage />} />
          <Route path="models/:id" element={<ModelDetailPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:id" element={<EventDetailPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="jobs/:id" element={<JobDetailPage />} />
          <Route path="mail" element={<MailPage />} />
          <Route path="mail/:id" element={<MailDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="notifications/:id" element={<NotificationDetailPage />} />
          <Route path="cache" element={<CachePage />} />
          <Route path="cache/:id" element={<CacheDetailPage />} />
          <Route path="redis" element={<RedisPage />} />
          <Route path="redis/:id" element={<RedisDetailPage />} />
          <Route path="gates" element={<GatesPage />} />
          <Route path="gates/:id" element={<GateDetailPage />} />
          <Route path="http-client" element={<HttpClientPage />} />
          <Route path="http-client/:id" element={<HttpClientDetailPage />} />
          <Route path="commands" element={<CommandsPage />} />
          <Route path="commands/:id" element={<CommandDetailPage />} />
          <Route path="schedules" element={<SchedulesPage />} />
          <Route path="schedules/:id" element={<ScheduleDetailPage />} />
          <Route path="dumps" element={<DumpsPage />} />
          <Route path="dumps/:id" element={<DumpDetailPage />} />
          <Route path="batches" element={<BatchesPage />} />
          <Route path="batches/:id" element={<BatchDetailPage />} />
          <Route path="views" element={<ViewsPage />} />
          <Route path="views/:id" element={<ViewDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
