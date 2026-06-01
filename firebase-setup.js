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

    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log("Auth state changed: User is signed in (UID:", user.uid, ")");
        } else {
            console.log("Auth state changed: User is signed out.");
        }
    });

    return { app, auth, database };
};