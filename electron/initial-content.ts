import os from "os";
import { getInitialContent } from "../src/common/initial-content.js"

export const initialContent = getInitialContent(os.platform(), false)
export const initialDevContent = getInitialContent(os.platform(), true)
