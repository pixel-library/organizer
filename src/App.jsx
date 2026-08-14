import { useState, useEffect, useCallback, useRef } from "react";
import { useLifePlanner } from "./hooks/useLifePlanner";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import CalendarView from "./components/CalendarView";
import Habits from "./components/Habits";
import Meals from "./components/Meals";
import Tasks from "./components/Tasks";
import Notes from "./components/Notes";
import History from "./components/History";
import Analytics from "./components/Analytics";
import Goals from "./components/Goals";
import Reminders from "./components/Reminders";
import TaskModal from "./components/TaskModal";
import ReminderModal from "./components/ReminderModal";
import EventEditor from "./components/EventEditor";
import NoteEditor from "./components/NoteEditor";
import MealEditor from "./components/MealEditor";
import QuickAdd from "./components/QuickAdd";
import CommandPalette from "./components/CommandPalette";
import SearchModal from "./components/SearchModal";
import UndoToast from "./components/UndoToast";
import ImportExportModal from "./components/ImportExportModal";
import AuthScreen from "./components/AuthScreen";

const VIEW_TITLES = {
  dashboard: "Dashboard Overview",
  calendar: "Task Calendar",
  habits: "Habit Tracker",
  meals: "Meal Planner",
  tasks: "My Tasks",
  notes: "Notes Section",
  history: "History Archive",
  analytics: "Productivity Analytics",
  goals: "Goals",
  reminders: "Reminders"
};

const CREATE_LABELS = {
  dashboard: "Create",
  calendar: "Create Event",
  habits: "New Habit",
  meals: "Plan Meal",
  tasks: "Create Task",
  notes: "Add Note",
  history: "History",
  analytics: "Export",
  goals: "New Goal",
  reminders: "New Reminder"
};

const THEME_CYCLE = ["dark", "light", "system"];

export default function App() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingOccurrenceDate, setEditingOccurrenceDate] = useState(null);
  const [eventPreset, setEventPreset] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [showMealModal, setShowMealModal] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [mealPreset, setMealPreset] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showReminder, setShowReminder] = useState(false);
  const [reminderText, setReminderText] = useState("");
  const [clockTime, setClockTime] = useState("");
  const [dashboardTime, setDashboardTime] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [ioOpen, setIoOpen] = useState(false);
  const [ioMode, setIoMode] = useState("export");
  const [goalOpenRequest, setGoalOpenRequest] = useState(0);
  const [reminderOpenRequest, setReminderOpenRequest] = useState(0);
  const [undoVisible, setUndoVisible] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const notifiedTasksRef = useRef(new Set());
  const undoTimeoutRef = useRef(null);

  const {
    tasks, history, goals, notes, habits, meals, calendarEvents, groceryList,
    customReminders, settings, setSettings,
    user, authStatus, authError, login, register, logout,
    toggleTaskCompletion, deleteTask, isTaskOverdue,
    addOrUpdateTask, bulkCompleteTasks, bulkDeleteTasks,
    updateGoalProgress, updateGoal, addGoal, deleteGoal,
    toggleHabitDay, addHabit, deleteHabit,
    updateMeal, addMeal, deleteMeal, setMealStatus,
    addNote, updateNote, deleteNote, toggleNoteArchive, restoreNote, toggleNotePin,
    removeHistoryItem, clearHistory, logHistory,
    addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
    updateCalendarEventOccurrence, deleteCalendarEventOccurrence,
    addGroceryItem, updateGroceryItem, deleteGroceryItem, toggleGroceryItem, clearPurchasedGrocery,
    addCustomReminder, deleteCustomReminder, toggleCustomReminder,
    undoState, undoLastDeletion,
    exportData, importData, replaceAllData, mergeData,
    formatDateKey, escapeHtml, priorityClass, priorityLabel, reminderLabel
  } = useLifePlanner();

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDashboardTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentDate = formatDateKey(now);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      tasks.forEach(task => {
        if (task.completed || task.reminder === "none" || notifiedTasksRef.current.has(task.id)) return;
        if (task.date !== currentDate) return;
        const [hours, minutes] = task.time.split(":").map(Number);
        const taskMinutes = hours * 60 + minutes;
        const difference = taskMinutes - currentMinutes;
        let shouldNotify = false;
        if (task.reminder === "exact" && difference === 0) shouldNotify = true;
        if (task.reminder === "10min" && difference === 10) shouldNotify = true;
        if (task.reminder === "30min" && difference === 30) shouldNotify = true;
        if (task.reminder === "1hour" && difference === 60) shouldNotify = true;
        if (shouldNotify) {
          notifiedTasksRef.current.add(task.id);
          setReminderText(`Reminder: "${task.name}" is scheduled for ${task.time}.`);
          setShowReminder(true);
        }
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [tasks, formatDateKey]);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const resolved = settings.theme === "system"
        ? (mq.matches ? "light" : "dark")
        : settings.theme;
      root.setAttribute("data-theme", resolved);
    };
    apply();
    if (settings.theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [settings.theme]);

  useEffect(() => {
    if (undoState) {
      setUndoVisible(true);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = setTimeout(() => setUndoVisible(false), 8000);
    } else {
      setUndoVisible(false);
    }
    return () => { if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current); };
  }, [undoState]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(p => !p);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const cycleTheme = useCallback(() => {
    const idx = THEME_CYCLE.indexOf(settings.theme);
    setSettings({ theme: THEME_CYCLE[(idx + 1) % THEME_CYCLE.length] });
  }, [settings.theme, setSettings]);

  const switchView = useCallback((view) => {
    setCurrentView(view);
  }, []);

  const openCreateModal = useCallback(() => {
    setEditingTask(null);
    setShowTaskModal(true);
  }, []);

  const openCreateModalForDate = useCallback((dateString) => {
    setEditingTask({ date: dateString });
    setShowTaskModal(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setShowTaskModal(false);
    setEditingTask(null);
  }, []);

  const saveModalEntry = useCallback((data) => {
    addOrUpdateTask({ ...data, editingId: editingTask?.id || null });
    closeCreateModal();
  }, [addOrUpdateTask, editingTask, closeCreateModal]);

  const editTask = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      setEditingTask(task);
      setShowTaskModal(true);
    }
  }, [tasks]);

  const updateTask = useCallback((id, patch) => {
    addOrUpdateTask({ ...patch, editingId: id });
  }, [addOrUpdateTask]);

  const openEventModal = useCallback((preset = null) => {
    setEditingEvent(null);
    setEditingOccurrenceDate(null);
    setEventPreset(preset);
    setShowEventModal(true);
  }, []);

  const closeEventModal = useCallback(() => {
    setShowEventModal(false);
    setEditingEvent(null);
    setEditingOccurrenceDate(null);
    setEventPreset(null);
  }, []);

  const saveEvent = useCallback((data, context) => {
    if (context?.dateKey && context?.originalId) {
      updateCalendarEventOccurrence(context.originalId, context.dateKey, data, context.mode || "this");
    } else if (data.editingId) {
      updateCalendarEvent(data.editingId, data);
    } else {
      addCalendarEvent(data);
    }
    closeEventModal();
  }, [addCalendarEvent, updateCalendarEvent, updateCalendarEventOccurrence, closeEventModal]);

  const editEvent = useCallback((id) => {
    const event = calendarEvents.find(e => e.id === id);
    if (event) {
      setEditingEvent(event);
      setEditingOccurrenceDate(null);
      setShowEventModal(true);
    }
  }, [calendarEvents]);

  const editOccurrence = useCallback((occurrence) => {
    const original = calendarEvents.find(e => e.id === occurrence.originalId) || occurrence;
    setEditingEvent(original);
    setEditingOccurrenceDate(occurrence.instanceDate);
    setEventPreset(null);
    setShowEventModal(true);
  }, [calendarEvents]);

  const deleteOccurrence = useCallback((originalId, dateKey, mode) => {
    deleteCalendarEventOccurrence(originalId, dateKey, mode);
  }, [deleteCalendarEventOccurrence]);

  const moveEvent = useCallback((evt, updates) => {
    if (evt.originalId) {
      updateCalendarEventOccurrence(evt.originalId, evt.instanceDate, updates, "this");
    } else {
      updateCalendarEvent(evt.id, updates);
    }
  }, [updateCalendarEvent, updateCalendarEventOccurrence]);

  const openNoteModal = useCallback(() => {
    setEditingNote(null);
    setShowNoteModal(true);
  }, []);

  const closeNoteModal = useCallback(() => {
    setShowNoteModal(false);
    setEditingNote(null);
  }, []);

  const saveNote = useCallback((data) => {
    if (data.editingId) {
      updateNote(data.editingId, data);
      logHistory(data.title, "Note Edited");
    } else {
      addNote(data);
      logHistory(data.title, "Note Created");
    }
    closeNoteModal();
  }, [addNote, updateNote, closeNoteModal, logHistory]);

  const editNote = useCallback((id) => {
    const note = notes.find(n => n.id === id);
    if (note) {
      setEditingNote(note);
      setShowNoteModal(true);
    }
  }, [notes]);

  const scheduleNote = useCallback((note) => {
    const date = new Date().toISOString().split("T")[0];
    const category = ["Personal", "Work", "Study"].includes(note.category) ? note.category : "Personal";
    openEventModal({
      date,
      title: note.title || "",
      description: note.content || "",
      category,
      allDay: false,
      startTime: "09:00",
      endTime: "10:00"
    });
  }, [openEventModal]);

  const openMealModal = useCallback((preset = null) => {
    setEditingMeal(null);
    setMealPreset(preset);
    setShowMealModal(true);
  }, []);

  const closeMealModal = useCallback(() => {
    setShowMealModal(false);
    setEditingMeal(null);
    setMealPreset(null);
  }, []);

  const saveMeal = useCallback((data) => {
    if (data.editingId) {
      updateMeal(data.editingId, data);
      logHistory(data.name, "Meal Updated");
    } else {
      addMeal(data);
      logHistory(data.name, "Meal Created");
    }
    closeMealModal();
  }, [addMeal, updateMeal, closeMealModal, logHistory]);

  const editMeal = useCallback((id) => {
    const meal = meals.find(m => m.id === id);
    if (meal) {
      setEditingMeal(meal);
      setMealPreset(null);
      setShowMealModal(true);
    }
  }, [meals]);

  const dismissReminder = useCallback(() => {
    setShowReminder(false);
  }, []);

  const handleCreateClick = useCallback(() => {
    if (currentView === "calendar") openEventModal();
    else if (currentView === "notes") openNoteModal();
    else if (currentView === "meals") openMealModal();
    else if (currentView === "habits") { const name = prompt("Enter habit name:"); if (name) addHabit(name); }
    else if (currentView === "analytics") { setIoMode("export"); setIoOpen(true); }
    else if (currentView === "goals") setGoalOpenRequest(n => n + 1);
    else if (currentView === "reminders") setReminderOpenRequest(n => n + 1);
    else if (currentView === "tasks" || currentView === "dashboard") openCreateModal();
  }, [currentView, openEventModal, openNoteModal, openMealModal, openCreateModal, addHabit]);

  const openCalendarForTask = useCallback((id) => {
    setSelectedTaskId(id);
    setCurrentView("calendar");
  }, []);

  const handleQuickAdd = useCallback((kind) => {
    if (kind === "task") { setCurrentView("tasks"); openCreateModal(); }
    else if (kind === "event") openEventModal();
    else if (kind === "habit") { const name = prompt("Enter habit name:"); if (name) addHabit(name); }
    else if (kind === "note") { setCurrentView("notes"); openNoteModal(); }
    else if (kind === "reminder") { setCurrentView("reminders"); setReminderOpenRequest(n => n + 1); }
    else if (kind === "meal") openMealModal();
  }, [openCreateModal, openEventModal, openNoteModal, openMealModal, addHabit]);

  const goToday = useCallback(() => {
    setCurrentView("calendar");
    const evt = new CustomEvent("organizer:goto-today");
    document.dispatchEvent(evt);
  }, []);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const openImportExport = useCallback((mode) => {
    setIoMode(mode || "export");
    setIoOpen(true);
  }, []);

  if (authStatus === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-2, #888)", fontSize: 14 }}>
        <span>Loading your workspace…</span>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return <AuthScreen onLogin={login} onRegister={register} error={authError} />;
  }

  return (
    <div className="flex antialiased">
      <Sidebar
        currentView={currentView}
        onSwitchView={switchView}
        historyCount={history.length}
        user={user}
        onLogout={logout}
        mobileOpen={mobileNavOpen}
        onMobileNavigate={() => setMobileNavOpen(false)}
      />
      {mobileNavOpen && <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)}></div>}
      <main className="app-main">
        <header className="top-header">
          <div className="header-title-wrap">
            <button className="mobile-menu-btn" onClick={() => setMobileNavOpen(p => !p)} aria-label="Toggle navigation">
              <i className="fa-solid fa-bars"></i>
            </button>
            <div>
              <span className="header-kicker">PERSONAL WORKSPACE</span>
              <h1 id="view-title">{VIEW_TITLES[currentView] || "Life Planner"}</h1>
            </div>
          </div>
          <div className="header-actions">
            <button className="header-icon-btn" onClick={openSearch} title="Search (Ctrl+S)" aria-label="Search">
              <i className="fa-solid fa-magnifying-glass"></i>
            </button>
            <button className="header-icon-btn" onClick={() => setPaletteOpen(true)} title="Command palette (Ctrl+K)" aria-label="Command palette">
              <i className="fa-solid fa-terminal"></i>
            </button>
            <button className="header-icon-btn theme-toggle" onClick={cycleTheme} title={`Theme: ${settings.theme}`} aria-label="Toggle theme">
              <i className={settings.theme === "light" ? "fa-solid fa-sun" : settings.theme === "system" ? "fa-solid fa-circle-half-stroke" : "fa-regular fa-moon"}></i>
            </button>
            <div className="live-clock">
              <i className="fa-regular fa-clock"></i>
              <span id="clock-time">{clockTime}</span>
            </div>
            <button onClick={handleCreateClick} className="header-create">
              <i className="fa-solid fa-plus"></i> {CREATE_LABELS[currentView] || "Create"}
            </button>
            <QuickAdd
              onAddTask={() => handleQuickAdd("task")}
              onAddEvent={() => handleQuickAdd("event")}
              onAddHabit={() => handleQuickAdd("habit")}
              onAddNote={() => handleQuickAdd("note")}
              onAddReminder={() => handleQuickAdd("reminder")}
              onAddMeal={() => handleQuickAdd("meal")}
            />
          </div>
        </header>
        <div className="page-container">
          {currentView === "dashboard" && (
            <Dashboard
              tasks={tasks}
              goals={goals}
              calendarEvents={calendarEvents}
              meals={meals}
              notes={notes}
              habits={habits}
              onSwitchView={switchView}
              onOpenCreate={openCreateModal}
              onOpenAddGoal={addGoal}
              onOpenEvent={openEventModal}
              onAddHabit={addHabit}
              onOpenNote={openNoteModal}
              onUpdateGoal={updateGoalProgress}
              onDeleteGoal={deleteGoal}
              onToggleTask={toggleTaskCompletion}
              onSelectTask={openCalendarForTask}
              formatDateKey={formatDateKey}
              escapeHtml={escapeHtml}
              priorityClass={priorityClass}
              dashboardTime={dashboardTime}
            />
          )}
          {currentView === "calendar" && (
            <CalendarView
              tasks={tasks}
              calendarEvents={calendarEvents}
              meals={meals}
              habits={habits}
              onOpenCreateForDate={openCreateModalForDate}
              onOpenEvent={openEventModal}
              onEditEvent={editEvent}
              onEditOccurrence={editOccurrence}
              onDeleteEvent={deleteCalendarEvent}
              onDeleteOccurrence={deleteOccurrence}
              onMoveEvent={moveEvent}
              onToggleTask={toggleTaskCompletion}
              onDeleteTask={deleteTask}
              onEditMeal={editMeal}
              onDeleteMeal={deleteMeal}
              onToggleHabit={toggleHabitDay}
              onSelectTask={openCalendarForTask}
              selectedTaskId={selectedTaskId}
              escapeHtml={escapeHtml}
              priorityClass={priorityClass}
              priorityLabel={priorityLabel}
              reminderLabel={reminderLabel}
              formatDateKey={formatDateKey}
            />
          )}
          {currentView === "habits" && (
            <Habits
              habits={habits}
              onToggleDay={toggleHabitDay}
              onAddHabit={addHabit}
              onDeleteHabit={deleteHabit}
              escapeHtml={escapeHtml}
            />
          )}
          {currentView === "meals" && (
            <Meals
              meals={meals}
              groceryList={groceryList}
              onAddMeal={addMeal}
              onUpdateMeal={updateMeal}
              onEditMeal={editMeal}
              onDeleteMeal={deleteMeal}
              onSetMealStatus={setMealStatus}
              onAddGrocery={addGroceryItem}
              onUpdateGrocery={updateGroceryItem}
              onDeleteGrocery={deleteGroceryItem}
              onToggleGrocery={toggleGroceryItem}
              onClearPurchased={clearPurchasedGrocery}
              onOpenMeal={openMealModal}
              escapeHtml={escapeHtml}
              formatDateKey={formatDateKey}
            />
          )}
          {currentView === "tasks" && (
            <Tasks
              tasks={tasks}
              isTaskOverdue={isTaskOverdue}
              onToggleTask={toggleTaskCompletion}
              onDeleteTask={deleteTask}
              onEditTask={editTask}
              onUpdateTask={updateTask}
              onOpenCreate={openCreateModal}
              onBulkComplete={bulkCompleteTasks}
              onBulkDelete={bulkDeleteTasks}
              onSelectTask={openCalendarForTask}
              escapeHtml={escapeHtml}
              priorityClass={priorityClass}
              priorityLabel={priorityLabel}
              reminderLabel={reminderLabel}
            />
          )}
          {currentView === "notes" && (
            <Notes
              notes={notes}
              onDeleteNote={deleteNote}
              onToggleArchive={toggleNoteArchive}
              onRestore={restoreNote}
              onTogglePin={toggleNotePin}
              onEditNote={editNote}
              onOpenNote={openNoteModal}
              onScheduleNote={scheduleNote}
              escapeHtml={escapeHtml}
            />
          )}
          {currentView === "analytics" && (
            <Analytics
              tasks={tasks}
              habits={habits}
              calendarEvents={calendarEvents}
              isTaskOverdue={isTaskOverdue}
              formatDateKey={formatDateKey}
              onSwitchView={switchView}
            />
          )}
          {currentView === "goals" && (
            <Goals
              goals={goals}
              onAddGoal={addGoal}
              onUpdateGoal={updateGoal}
              onDeleteGoal={deleteGoal}
              escapeHtml={escapeHtml}
              openRequest={goalOpenRequest}
            />
          )}
          {currentView === "reminders" && (
            <Reminders
              tasks={tasks}
              calendarEvents={calendarEvents}
              customReminders={customReminders}
              isTaskOverdue={isTaskOverdue}
              onAddCustom={addCustomReminder}
              onDeleteCustom={deleteCustomReminder}
              onToggleCustom={toggleCustomReminder}
              onOpenEvent={openEventModal}
              onOpenTaskModal={editTask}
              escapeHtml={escapeHtml}
              openRequest={reminderOpenRequest}
            />
          )}
          {currentView === "history" && (
            <History
              history={history}
              onRemoveItem={removeHistoryItem}
              onClear={clearHistory}
              escapeHtml={escapeHtml}
            />
          )}
        </div>
      </main>
      {showTaskModal && (
        <TaskModal
          editingTask={editingTask}
          onSave={saveModalEntry}
          onClose={closeCreateModal}
        />
      )}
      {showEventModal && (
        <EventEditor
          event={editingEvent}
          preset={eventPreset}
          occurrenceDate={editingOccurrenceDate}
          onSave={saveEvent}
          onClose={closeEventModal}
        />
      )}
      {showNoteModal && (
        <NoteEditor
          note={editingNote}
          onSave={saveNote}
          onClose={closeNoteModal}
        />
      )}
      {showMealModal && (
        <MealEditor
          meal={editingMeal}
          preset={mealPreset}
          onSave={saveMeal}
          onClose={closeMealModal}
        />
      )}
      {showReminder && (
        <ReminderModal text={reminderText} onDismiss={dismissReminder} />
      )}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenView={switchView}
        onCreateTask={openCreateModal}
        onCreateEvent={openEventModal}
        onCreateNote={openNoteModal}
        onCreateHabit={() => { const name = prompt("Enter habit name:"); if (name) addHabit(name); }}
        onGoToday={goToday}
        onOpenSearch={openSearch}
        onExport={() => openImportExport("export")}
        onImport={() => openImportExport("import")}
      />
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        tasks={tasks}
        calendarEvents={calendarEvents}
        notes={notes}
        habits={habits}
        meals={meals}
        history={history}
        onOpenView={switchView}
        onEditEvent={editEvent}
        onEditNote={editNote}
        onEditTask={editTask}
        escapeHtml={escapeHtml}
      />
      <ImportExportModal
        open={ioOpen}
        onClose={() => setIoOpen(false)}
        initialMode={ioMode}
        exportData={exportData}
        importData={importData}
        replaceAllData={replaceAllData}
        mergeData={mergeData}
      />
      <UndoToast undoState={undoVisible ? undoState : null} onUndo={undoLastDeletion} />
    </div>
  );
}
