"use client";
import { createContext, useContext } from "react";

// { id, name, token, role, email } : l'église de l'utilisateur connecté
const Ctx = createContext(null);
export const ChurchProvider = ({ value, children }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useChurch = () => useContext(Ctx);
