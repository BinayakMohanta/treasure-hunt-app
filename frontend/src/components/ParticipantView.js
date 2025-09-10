import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import QrScanner from 'react-qr-scanner';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const socket = io(API_URL);

// --- COMPONENT FOR DISPLAYING RIDDLES AND SCANNING ---
const RiddleScreen = ({ teamData, onScanResult }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [activeTab, setActiveTab] = useState('current');
    const [errorMessage, setErrorMessage] = useState('');

    const handleScan = (data) => {
        if (data) {
            setIsScanning(false);
            onScanResult(data.text);
        }
    };
    const handleScanError = (err) => {
        console.error(err);
        setErrorMessage("Could not access camera. Please check permissions.");
        setIsScanning(false);
    };

    if (isScanning) {
        return (
            <div className="scanner-container fade-in">
                <h2>Scan QR Code</h2>
                <div className="webcam-container">
                    <QrScanner
                        delay={300}
                        onError={handleScanError}
                        onScan={handleScan}
                        style={{ width: '100%' }}
                        constraints={{ video: { facingMode: "environment" } }}
                    />
                </div>
                <button onClick={() => setIsScanning(false)} className="admin-button" style={{marginTop: '1rem'}}>Cancel Scan</button>
            </div>
        );
    }
    
    return (
        <div className="game-screen fade-in">
            <h2>The Hunt is On!</h2>
            {errorMessage && <p style={{color: 'red'}}>{errorMessage}</p>}
            <div className="tabs">
                <button onClick={() => setActiveTab('current')} className={activeTab === 'current' ? 'active' : ''}>Current Riddle</button>
                <button onClick={() => setActiveTab('past')} className={activeTab === 'past' ? 'active' : ''}>Past Riddles</button>
            </div>
            {activeTab === 'current' ? (
                <div className="riddle-card">
                    <p>{teamData.currentRiddle || "Your first riddle is waiting... Scan the starting QR code!"}</p>
                </div>
            ) : (
                <div className="riddle-card past-riddles">
                    {teamData.riddlesSolved && teamData.riddlesSolved.length > 0 ? (
                        <ul style={{paddingLeft: '20px'}}>
                            {teamData.riddlesSolved.map((item, index) => (
                                <li key={index}><strong>{item.location}:</strong> {item.riddle}</li>
                            ))}
                        </ul>
                    ) : <p>No past riddles yet.</p>}
                </div>
            )}
            <button onClick={() => { setIsScanning(true); setErrorMessage(''); }} className="scan-button">Scan Next Clue</button>
        </div>
    );
};

// --- COMPONENT FOR CAPTURING AND UPLOADING SELFIES ---
const SelfieScreen = ({ teamData, onUploadSuccess }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Please take a team selfie for verification.');
    const webcamRef = useRef(null);

    const capture = useCallback(() => setImageSrc(webcamRef.current.getScreenshot()), [webcamRef]);
    const retakePhoto = () => setImageSrc(null);

    const handleUpload = async () => {
        if (!imageSrc || isUploading) return;
        setIsUploading(true);
        setStatusMessage('Uploading...');
        try {
            const response = await fetch(`${API_URL}/api/teams/upload-selfie`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamCode: teamData.teamCode, imageSrc }),
            });
            if (response.ok) {
                setStatusMessage('Selfie submitted! Waiting for admin approval...');
                onUploadSuccess(); 
            } else {
                 const data = await response.json();
                 setStatusMessage(data.message || 'Upload failed. Please try again.');
                 setIsUploading(false);
            }
        } catch (error) {
            setStatusMessage('Upload failed. Please try again.');
            setIsUploading(false);
        }
    };
    
    return (
         <div className="selfie-screen fade-in">
            <h2>Welcome, {teamData.teamName || teamData.teamCode}!</h2>
            <p className="status-message">{statusMessage}</p>
            <div className="webcam-container">
                {imageSrc ? <img src={imageSrc} alt="Team Selfie" /> : <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ width: 400, height: 400, facingMode: "user" }} />}
                {isUploading && <div className="waiting-overlay"><div className="spinner"></div></div>}
            </div>
            <div className="selfie-controls">
                {imageSrc ? (
                    <>
                        <button onClick={handleUpload} disabled={isUploading}>{isUploading ? 'Uploading...' : 'Upload for Verification'}</button>
                        <button onClick={retakePhoto} className="admin-button" disabled={isUploading}>Retake Photo</button>
                    </>
                ) : (
                    <button onClick={capture}>Capture Photo</button>
                )}
            </div>
        </div>
    );
};


// --- MAIN CONTROLLER COMPONENT FOR PARTICIPANTS ---
const ParticipantView = ({ teamData: initialTeamData }) => {
    const [teamData, setTeamData] = useState(initialTeamData);
    
    useEffect(() => {
        const handleTeamUpdate = (updatedTeamFromServer) => {
            if(updatedTeamFromServer.teamCode === initialTeamData.teamCode) {
                setTeamData(updatedTeamFromServer);
            }
        };
        socket.on('teamUpdate', handleTeamUpdate);

        const handleSelfieRejected = () => {
             alert("Your selfie was rejected by the admin. Please retake and upload a new one.");
             setTeamData(prev => ({...prev, selfie: { url: "", isVerified: false }}));
        };
        socket.on(`selfieRejected_${initialTeamData.teamCode}`, handleSelfieRejected);
        
        return () => {
            socket.off('teamUpdate', handleTeamUpdate);
            socket.off(`selfieRejected_${initialTeamData.teamCode}`, handleSelfieRejected);
        };
    }, [initialTeamData.teamCode]);

    const handleScanResult = async (qrIdentifier) => {
        try {
            const response = await fetch(`${API_URL}/api/teams/scan-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamCode: teamData.teamCode, qrIdentifier }),
            });
            if (!response.ok) {
                 const data = await response.json();
                 alert(data.message || "An error occurred.");
            }
        } catch (error) {
            alert("Failed to connect to the server.");
        }
    };
    
    if (teamData.endTime) {
        const startTime = new Date(teamData.startTime);
        const endTime = new Date(teamData.endTime);
        const diff = endTime.getTime() - startTime.getTime();
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        const finalTime = `${hours}h ${minutes}m ${seconds}s`;

        return (
            <div className="completion-screen fade-in">
                <h2>Congratulations, {teamData.teamName}!</h2>
                <p>You have completed the Treasure Hunt!</p>
                <div className="final-time-card">
                    <h3>Final Time</h3>
                    <p>{finalTime}</p>
                </div>
            </div>
        );
    }
    
    if (teamData && teamData.selfie && teamData.selfie.isVerified) {
        return <RiddleScreen teamData={teamData} onScanResult={handleScanResult} />;
    } else {
        return <SelfieScreen teamData={teamData} onUploadSuccess={() => setTeamData(prev => ({...prev, selfie: {...(prev.selfie || {}), url: "PENDING"}}))}/>;
    }
};

export default ParticipantView;

