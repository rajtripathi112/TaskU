PRAGMA foreign_keys = ON;

CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(name) <= 80),
    description TEXT CHECK (description IS NULL OR length(description) <= 400),
    employee_name TEXT NOT NULL CHECK (length(employee_name) <= 60),
    priority TEXT CHECK (priority IN ('Low', 'Medium', 'High')),
    status TEXT CHECK (status IN ('To Do', 'In Progress', 'Done')),
    start_date TEXT CHECK (
        start_date IS NULL OR (
            start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
            AND date(start_date, '+0 days') = start_date
        )
    ),
    due_date TEXT NOT NULL CHECK (
        due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        AND date(due_date, '+0 days') = due_date
    ),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER tasks_set_updated_at
AFTER UPDATE ON tasks
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE tasks
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;
