import toast from "react-hot-toast";
import { useEffect, useMemo, useState } from "react";

import AnalyticsChart from "../../components/admin/AnalyticsChart";
import Loader from "../../components/common/Loader";
import StatCard from "../../components/common/StatCard";
import { listEvents } from "../../services/eventService";
import { analyticsSeries, dashboardStats } from "../../utils/mockData";
import { formatNumber } from "../../utils/formatters";

function AnalyticsPage() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      try {
        const data = await listEvents();
        if (isMounted) {
          setEvents(data);
        }
      } catch (_error) {
        toast.error("Unable to load analytics summary.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadEvents();
    return () => {
      isMounted = false;
    };
  }, []);

  const connectedStats = useMemo(() => {
    const totalEvents = events.length;
    const totalUploads = events.reduce((sum, event) => sum + (event.photo_count || 0), 0);

    return dashboardStats.map((stat) => {
      if (stat.label === "Total Events") {
        return { ...stat, value: formatNumber(totalEvents), change: "Across your events" };
      }

      if (stat.label === "Total Uploads") {
        return { ...stat, value: formatNumber(totalUploads), change: "Across your events" };
      }

      return stat;
    });
  }, [events]);

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {connectedStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {isLoading ? <Loader label="Loading analytics summary..." /> : null}

      <AnalyticsChart series={analyticsSeries} />

      <div className="grid gap-6 lg:grid-cols-3">
        {[
          {
            title: "Guest search spikes",
            text: "Peak usage appears during the first two days after the event, especially once the reception album is uploaded."
          },
          {
            title: "Best conversion channel",
            text: "Printed QR cards and entry signage are the easiest guest entry point on mobile."
          },
          {
            title: "Photo delivery tip",
            text: "Upload photos after each part of the celebration so guests can find their memories sooner."
          }
        ].map((item) => (
          <article key={item.title} className="glass-panel">
            <h2 className="text-2xl font-semibold text-[var(--text)]">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default AnalyticsPage;
