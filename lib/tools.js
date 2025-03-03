import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

prisma.$connect();

// get all todos 
export async function getAllTodos() {
    try {
        const allTodos = await prisma.todo.findMany();
        return allTodos;
    } catch (error) {
        console.error("Error getting all todos:", error);
        return { error: "Failed to retrieve todos" };
    }
}

// create a new todo
export async function createTodo(input) {
    try {
        if (!input || typeof input !== 'string') {
            throw new Error("Invalid input: title must be a non-empty string");
        }
        
        const newTodo = await prisma.todo.create({
            data: {
                title: input
            }
        });
        return newTodo.id;
    } catch (error) {
        console.error("Error creating todo:", error);
        return { error: `Failed to create todo: ${error.message}` };
    }
}

// update a todo
export async function updateTodoById(id, input) {
    try {
        if (!id) {
            throw new Error("Missing todo ID");
        }
        
        if (!input || typeof input !== 'string') {
            throw new Error("Invalid input: title must be a non-empty string");
        }
        
        const updatedTodo = await prisma.todo.update({
            where: { id },
            data: {
                title: input
            }
        });
        return updatedTodo.id;
    } catch (error) {
        console.error(`Error updating todo ${id}:`, error);
        return { error: `Failed to update todo: ${error.message}` };
    }
}

// delete a todo
export async function deleteTodoById(id) {
    try {
        if (!id) {
            throw new Error("Missing todo ID");
        }
        
        const deletedTodo = await prisma.todo.delete({
            where: { id }
        });
        return deletedTodo.id;
    } catch (error) {
        console.error(`Error deleting todo ${id}:`, error);
        return { error: `Failed to delete todo: ${error.message}` };
    }
}

// search todo
export async function searchTodos(search) {
    try {
        if (!search || typeof search !== 'string') {
            throw new Error("Invalid search term");
        }
        
        const searchedTodos = await prisma.todo.findMany({
            where: {
                OR: [
                    {
                        title: {
                            contains: search
                        }
                    }
                ]
            }
        });
        return searchedTodos;
    } catch (error) {
        console.error(`Error searching todos for "${search}":`, error);
        return { error: `Failed to search todos: ${error.message}` };
    }
}