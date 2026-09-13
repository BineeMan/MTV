import { User } from "./User.ts";

const users = new Map<number, User>();
users.set(1, new User("Asd", 1));
users.get(1)