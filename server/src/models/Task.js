import mongoose from "mongoose";

// Доска повседневных дел — отдельная от заказов. Здесь не деньги, а задачи:
// «купить бумагу», «позвонить клиенту», «сделать ТО принтера».
export const TASK_STATUSES = ["todo", "in_progress", "done"];
export const TASK_PRIORITIES = ["low", "medium", "high"];

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    status: { type: String, enum: TASK_STATUSES, default: "todo" },
    priority: { type: String, enum: TASK_PRIORITIES, default: "medium" },
    dueDate: { type: Date, default: null },

    // Порядок карточки внутри колонки (как в канбане заказов).
    position: { type: Number, default: 0 },

    // Момент перехода в «Готово» — по нему можно показать «сделано сегодня».
    // Снимается, если задачу вернули в работу.
    completedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

taskSchema.index({ status: 1, position: 1 });

export default mongoose.model("Task", taskSchema);
