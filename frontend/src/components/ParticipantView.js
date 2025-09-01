import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';

// Basic styling for the webcam component
const videoConstraints = {
    width: 400,
    height: 400,
    facingMode: "user" // Use the front-facing camera
};

const ParticipantView = ({ teamData }) => {
    // This state will hold the captured image data
    const [imageSrc, setImageSrc] = useState(null);
    const [statusMessage, setStatusMessage] = useState('Please take a team selfie for verification.');
    
    // A reference to the webcam component to access its methods
    const webcamRef = useRef(null);

    // This function is called when the "Capture" button is clicked
    const capture = useCallback(() => {
        // Get the image data from the webcam as a base64 string
        const image = webcamRef.current.getScreenshot();
        setImageSrc(image);
    }, [webcamRef, setImageSrc]);
    
    // Function to handle retaking the photo
    const retakePhoto = () => {
        setImageSrc(null);
    };

    // This function will eventually send the image to the backend
    const handleUpload = () => {
        if (!imageSrc) return;
        
        setStatusMessage('Selfie submitted! Waiting for admin approval...');
        
        // --- NEXT STEPS ---
        // In a future update, we will add the code here to:
        // 1. Send the `imageSrc` data to our backend on Render.
        // 2. The backend will save it and notify the admin.
        // 3. The app will then wait for a real-time signal that the admin has approved it.
    };

    return (
        <div style={{ color: '#EAE0C8' }}>
            <h2>Welcome, {teamData.teamName || teamData.teamCode}!</h2>
            <p style={{ color: '#C3B091', marginBottom: '1.5rem' }}>{statusMessage}</p>

            {/* This is the core logic: it shows either the captured image or the live webcam */}
            <div className="camera-container" style={{ margin: 'auto', width: '90%', maxWidth: '350px', borderRadius: '10px', overflow: 'hidden', border: '2px solid #654321' }}>
                {imageSrc ? (
                    // If a photo has been taken, show the preview
                    <img src={imageSrc} alt="Team Selfie" />
                ) : (
                    // Otherwise, show the live webcam feed
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={videoConstraints}
                    />
                )}
            </div>
            
            <div className="controls" style={{ marginTop: '1.5rem' }}>
                {imageSrc ? (
                    // If a photo has been taken, show the Upload/Retake buttons
                    <>
                        <button onClick={handleUpload}>Upload for Verification</button>
                        <button onClick={retakePhoto} className="admin-button">Retake Photo</button>
                    </>
                ) : (
                    // Otherwise, show the Capture button
                    <button onClick={capture}>Capture Photo</button>
                )}
            </div>
        </div>
    );
};

export default ParticipantView;
