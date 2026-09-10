import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # We want to replace `const saved = localStorage.getItem('...');` 
    # with `const saved = typeof window !== 'undefined' ? localStorage.getItem('...') : null;`
    # if it's inside `useState` and not already checked.

    # Simple regex to find `localStorage.getItem(...)` and wrap it if it's not already wrapped
    # But only if it's inside a useState initializer. Since the problem is general, we can just safely
    # replace `localStorage.getItem` everywhere it isn't preceded by `typeof window !== 'undefined' ?` 
    # or inside an `if (typeof window !== 'undefined')`.

    # A simpler and very safe fix: replace `localStorage.getItem` with `(typeof window !== 'undefined' ? localStorage.getItem : () => null)`
    # This might break syntax if used like `localStorage.getItem(...)` directly?
    # No, it's safer to do: `(typeof window !== 'undefined' ? localStorage.getItem("KEY") : null)`
    
    # Let's do a targeted regex for the exact patterns we saw:
    # `const saved = localStorage.getItem` -> `const saved = typeof window !== 'undefined' ? localStorage.getItem`
    
    pattern = re.compile(r'(const\s+\w+\s*=\s*)localStorage\.getItem\(')
    new_content = pattern.sub(r'\1typeof window !== "undefined" ? localStorage.getItem(', content)
    
    # We also need to add `: null` at the end of the call if we used the ternary.
    # Actually, a better regex: `localStorage\.getItem\(([^)]+)\)`
    # replace with `(typeof window !== 'undefined' ? localStorage.getItem(\1) : null)`
    
    pattern2 = re.compile(r'(?<!\? )localStorage\.getItem\(([^)]+)\)')
    # But wait, there might be places where we already have `if (typeof window !== 'undefined') { ... localStorage.getItem(...) }`.
    # Wrapping it again `(typeof window !== 'undefined' ? ... : null)` is completely safe and valid JS!
    
    # Let's just wrap all `localStorage.getItem(...)` and `localStorage.setItem(...)` and `localStorage.removeItem(...)`
    # Actually `setItem` inside `useEffect` is fine because `useEffect` only runs on client. But `getItem` in `useState` runs on server.
    
    # So we replace `localStorage.getItem(X)` with `(typeof window !== 'undefined' ? localStorage.getItem(X) : null)`
    # But only if it doesn't already have `typeof window` next to it to avoid mess.
    
    def repl(m):
        # check if already wrapped in our ternary
        full_match = m.group(0)
        args = m.group(1)
        return f"(typeof window !== 'undefined' ? localStorage.getItem({args}) : null)"
    
    content_fixed = re.sub(r'localStorage\.getItem\((.*?)\)', repl, content)
    
    # Let's run this blindly on the files we found
    if content != content_fixed:
        with open(filepath, 'w') as f:
            f.write(content_fixed)
            print(f"Fixed {filepath}")

files = [
    "src/components/sales/SalesSettings.tsx",
    "src/components/workspace/ResourceManagement.tsx",
    "src/components/workspace/SeatingArrangement.tsx",
    "src/components/admin/Restrictions.tsx",
    "src/components/work/Projects.tsx",
    "src/components/finance/FinancialPlan.tsx",
    "src/components/finance/Transactions.tsx",
    "src/components/finance/OtherTransactions.tsx",
    "src/components/work/WorkLogs.tsx",
    "src/components/work/Tasks.tsx",
    "src/components/work/Research.tsx",
    "src/components/work/Chat.tsx",
    "src/components/documents/tabs/DocumentTypes.tsx",
    "src/components/documents/tabs/DocumentTemplates.tsx",
    "src/components/invoice/CreateInvoice.tsx"
]

for f in files:
    if os.path.exists(f):
        fix_file(f)

