import React, { useEffect } from "react"

export function useLocalStorageState(name, initialState) {
    const [state, setState] = React.useState(() => {
        const savedState = localStorage.getItem(name)
        if (savedState == null) {
            if (typeof initialState === 'function') {
                return initialState()
            } else {
                return initialState
            }
        }
        return JSON.parse(savedState)
    })

    useEffect(() => {
        localStorage.setItem(name, JSON.stringify(state))
    }, [state])

    return [state, setState]
}