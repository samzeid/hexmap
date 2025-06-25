window.FirebaseSetup = () => {
    // Firebase initialization.
    const firebaseConfig = {
        apiKey: "AIzaSyAOXPGwEFekK9tRauXOVVWtPLGT7WZf668",
        authDomain: "hexcrawl-650cd.firebaseapp.com",
        projectId: "hexcrawl-650cd",
        storageBucket: "hexcrawl-650cd.appspot.com",
        appId: "1:95939330375:web:69b0c546db5b00d996cc62",
        databaseURL: "https://hexcrawl-650cd-default-rtdb.firebaseio.com"
    };

    const app = firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const database = app.database();

    authenticateFromUrl();

    // Use the url to pass in an email and password for authentication.
    function authenticateFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const email = urlParams.get("email");
        const password = urlParams.get("password");

        if (email && password) {
            console.log("Found email and password in URL. Attempting sign in...");

            auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                console.log("Sign in successful with shared credentials.");
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                console.error("Authentication Error:", errorCode, errorMessage);
            });
        } else {
            console.log("No email or password found in URL.");
        }
    }

    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log("Auth state changed: User is signed in (UID:", user.uid, ")");
        } else {
            console.log("Auth state changed: User is signed out.");
        }
    });

    return { app, auth, database };
};