import React, { createContext, useContext, useEffect, useState } from "react";
import type { EventModel, ClassModel } from "../types";
import { fetchEvents } from "../services/eventService";
import { fetchClasses } from "../services/classService";
import { useAuth } from "./AuthContext";

interface EventContextType {
  events: EventModel[];
  activeEvent: EventModel | null;
  classes: ClassModel[];
  loading: boolean;
  setActiveEvent: (ev: EventModel | null) => void;
  refreshEvents: () => Promise<void>;
  refreshClasses: () => Promise<void>;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const [events, setEvents] = useState<EventModel[]>([]);
  const [activeEvent, setActiveEvent] = useState<EventModel | null>(null);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    if (!userProfile) {
      setEvents([]);
      setActiveEvent(null);
      setClasses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [eventsList, classesList] = await Promise.all([
        fetchEvents(),
        fetchClasses(),
      ]);

      setEvents(eventsList);
      setClasses(classesList);

      // Default active event to the first active event or first event
      if (!activeEvent || !eventsList.some((e) => e.id === activeEvent.id)) {
        const defaultActive = eventsList.find((e) => e.status === "active") || eventsList[0] || null;
        setActiveEvent(defaultActive);
      }
    } catch (err) {
      console.error("Error loading events and classes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userProfile?.uid]);

  const refreshEvents = async () => {
    const list = await fetchEvents();
    setEvents(list);
    if (activeEvent) {
      const updated = list.find((e) => e.id === activeEvent.id);
      if (updated) setActiveEvent(updated);
    }
  };

  const refreshClasses = async () => {
    const list = await fetchClasses();
    setClasses(list);
  };

  return (
    <EventContext.Provider
      value={{
        events,
        activeEvent,
        classes,
        loading,
        setActiveEvent,
        refreshEvents,
        refreshClasses,
      }}
    >
      {children}
    </EventContext.Provider>
  );
};

export const useEvent = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEvent must be used within an EventProvider");
  }
  return context;
};
