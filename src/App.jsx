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
import TaskModal from "./components/TaskModal";
import ReminderModal from "./components/ReminderModal";
import EventEditor from "./components/EventEditor";
import NoteEditor from "./components/NoteEditor";
import MealEditor from "./components/MealEditor";

const VIEW_TITLES = {
  dashboard: "Dashboard Overview",
  calendar: "Task Calendar",
  habits: "Habit Tracker",
  meals: "Meal Planner",
  tasks: "My Tasks",
  notes: "Notes Section",
  history: "History Archive"
};

const CREATE_LABELS = {
  dashboard: "Create",
  calendar: "Create Event",
  habits: "New Habit",
  meals: "Plan Meal",
  tasks: "Create Task",
  notes: "Add Note",
  history: "History"
};

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
  const notifiedTasksRef = useRef(new Set());

  const {
    tasks, history, goals, notes, habits, meals, calendarEvents, groceryList,
    toggleTaskCompletion, deleteTask, isTaskOverdue,
    addOrUpdateTask, bulkCompleteTasks, bulkDeleteTasks,
    updateGoalProgress, addGoal, deleteGoal,
    toggleHabitDay, addHabit, deleteHabit,
    updateMeal, addMeal, deleteMeal, setMealStatus,
    addNote, updateNote, deleteNote, toggleNoteArchive, restoreNote, toggleNotePin,
    removeHistoryItem, clearHistory, logHistory,
    addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
    updateCalendarEventOccurrence, deleteCalendarEventOccurrence,
    addGroceryItem, updateGroceryItem, deleteGroceryItem, toggleGroceryItem, clearPurchasedGrocery,
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
    else if (currentView === "tasks" || currentView === "dashboard") openCreateModal();
  }, [currentView, openEventModal, openNoteModal, openMealModal, openCreateModal, addHabit]);

  const openCalendarForTask = useCallback((id) => {
    setSelectedTaskId(id);
    setCurrentView("calendar");
  }, []);

  return (
    <div className="flex antialiased">
      <Sidebar currentView={currentView} onSwitchView={switchView} historyCount={history.length} />
      <main className="app-main flex-1 min-w-0 min-h-screen bg-custom-matt">
        <header className="top-header">
          <div>
            <span className="header-kicker">PERSONAL WORKSPACE</span>
            <h1 id="view-title">{VIEW_TITLES[currentView] || "Life Planner"}</h1>
          </div>
          <div className="header-actions">
            <div className="live-clock">
              <i className="fa-regular fa-clock"></i>
              <span id="clock-time">{clockTime}</span>
            </div>
            <button onClick={handleCreateClick} className="header-create">
              <i className="fa-solid fa-plus"></i> {CREATE_LABELS[currentView] || "Create"}
            </button>
          </div>
        </header>
        <div className="page-container">
          {currentView === "dashboard" && (
            <Dashboard
              tasks={tasks}
              goals={goals}
              history={history}
              calendarEvents={calendarEvents}
              meals={meals}
              notes={notes}
              onSwitchView={switchView}
              onOpenCreate={openCreateModal}
              onOpenAddGoal={addGoal}
              onUpdateGoal={updateGoalProgress}
              onDeleteGoal={deleteGoal}
              onToggleTask={toggleTaskCompletion}
              onSelectTask={openCalendarForTask}
              formatDateKey={formatDateKey}
              escapeHtml={escapeHtml}
              priorityClass={priorityClass}
              priorityLabel={priorityLabel}
              reminderLabel={reminderLabel}
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
    </div>
  );
}
