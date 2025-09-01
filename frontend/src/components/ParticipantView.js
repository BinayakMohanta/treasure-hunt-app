import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { QrReader } from 'react-qr-reader';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const socket = io(API_URL);

// --- GAME SCREEN COMPONENT ---
const GameScreen = ({ teamData }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [currentRiddle, setCurrentRiddle] = useState(teamData.currentRiddle || "Your first riddle is waiting... Scan the starting QR code!");
    const [pastRiddles, setPastRiddles] = useState(teamData.riddlesSolved || []);
    const [activeTab, setActiveTab] = useState('current');
    const [isFinished, setIsFinished] = useState(!!teamData.endTime);
    const [finalTime, setFinalTime] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (teamData.endTime && teamData.startTime) {
            const startTime = new Date(teamData.startTime);
            const endTime = new Date(teamData.endTime);
            const diff = endTime.getTime() - startTime.getTime();
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setFinalTime(`${hours}h ${minutes}m ${seconds}s`);
        }
    }, [teamData.endTime, teamData.startTime]);

    const handleScanResult = async (result) => {
        if (result) {
            setIsScanning(false);
            const qrIdentifier = result.text;
            
            try {
                const response = await fetch(`${API_URL}/api/teams/scan-qr`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ teamCode: teamData.teamCode, qrIdentifier }),
                });

                const data = await response.json();

                if (response.ok) {
                    setErrorMessage('');
                    if (data.finished) {
                        setIsFinished(true);
                    } else {
                        setPastRiddles(prev => [...prev, { riddle: currentRiddle, location: "Previous Location" }]);
                        setCurrentRiddle(data.newRiddle);
                    }
                } else {
                    setErrorMessage(data.message || "An error occurred.");
                }
            } catch (error) {
                setErrorMessage("Failed to connect to the server.");
            }
        }
    };

    if (isFinished) {
        return (
            <div className="game-screen">
                <h2>Congratulations, {teamData.teamName}!</h2>
                <p>You have completed the Treasure Hunt!</p>
                <div className="riddle-card" style={{backgroundColor: '#C3B091', color: 'white', padding: '1.5rem', borderRadius: '10px', marginTop: '1.5rem'}}>
                    <h3>Final Time</h3>
                    <p>{finalTime}</p>
                </div>
            </div>
        );
    }
    
    if (isScanning) {
        return (
            <div>
                <h2>Scan QR Code</h2>
                <QrReader
                    onResult={(result, error) => {
                        if (!!result) {
                            handleScanResult(result);
                        }
                    }}
                    constraints={{ facingMode: 'environment' }}
                    style={{ width: '100%' }}
                />
                <button onClick={() => setIsScanning(false)} className="admin-button" style={{marginTop: '1rem'}}>Cancel</button>
            </div>
        );
    }

    return (
        <div className="game-screen" style={{color: '#EAE0C8'}}>
            <h2>The Hunt is On!</h2>
            {errorMessage && <p style={{ color: 'red', fontWeight: 'bold' }}>{errorMessage}</p>}
            <div className="tabs" style={{display: 'flex', marginBottom: '1rem'}}>
                <button onClick={() => setActiveTab('current')} style={{ flex: 1, borderBottom: activeTab === 'current' ? '2px solid #C3B091' : '2px solid transparent' }}>Current Riddle</button>
                <button onClick={() => setActiveTab('past')} style={{ flex: 1, borderBottom: activeTab === 'past' ? '2px solid #C3B091' : '2px solid transparent' }}>Past Riddles</button>
            </div>
            {activeTab === 'current' ? (
                <div className="riddle-card" style={{backgroundColor: '#C3B091', color: 'white', padding: '1.5rem', borderRadius: '10px'}}>
                    <p>{currentRiddle}</p>
                </div>
            ) : (
                <div className="riddle-card" style={{backgroundColor: '#654321', color: 'white', padding: '1.5rem', borderRadius: '10px', textAlign: 'left'}}>
                    {pastRiddles.length > 0 ? (
                        <ul style={{listStyle: 'none', padding: 0}}>
                            {pastRiddles.map((item, index) => (
                                <li key={index} style={{marginBottom: '0.5rem'}}><strong>{item.location}:</strong> {item.riddle}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>No past riddles yet.</p>
                    )}
                </div>
            )}
            <button onClick={() => { setIsScanning(true); setErrorMessage(''); }} style={{width: '100%', padding: '20px', fontSize: '1.5rem', marginTop: '1rem'}}>Scan Next Clue</button>
        </div>
    );
};

// --- SELFIE VERIFICATION COMPONENT ---
const SelfieScreen = ({ teamData }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [statusMessage, setStatusMessage] = useState('Please take a team selfie for verification.');
    const webcamRef = useRef(null);

    const capture = useCallback(() => {
        const image = webcamRef.current.getScreenshot();
        setImageSrc(image);
    }, [webcamRef]);

    const retakePhoto = () => setImageSrc(null);

    const handleUpload = async () => {
        if (!imageSrc) return;
        setStatusMessage('Uploading...');
        try {
            await fetch(`${API_URL}/api/teams/upload-selfie`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamCode: teamData.teamCode, imageSrc }),
            });
            setStatusMessage('Selfie submitted! Waiting for admin approval...');
        } catch (error) {
            setStatusMessage('Upload failed. Please try again.');
        }
    };

    return (
         <div style={{ color: '#EAE0C8' }}>
            <h2>Welcome, {teamData.teamName || teamData.teamCode}!</h2>
            <p style={{ color: '#C3B091', marginBottom: '1.5rem', minHeight: '40px' }}>{statusMessage}</p>
            <div style={{ margin: 'auto', width: '90%', maxWidth: '350px', borderRadius: '10px', overflow: 'hidden', border: '2px solid #654321' }}>
                {imageSrc ? <img src={imageSrc} alt="Team Selfie" /> : <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ width: 400, height: 400, facingMode: "user" }} />}
            </div>
            <div style={{ marginTop: '1.5rem' }}>
                {imageSrc ? (
                    <>
                        <button onClick={handleUpload}>Upload for Verification</button>
                        <button onClick={retakePhoto} className="admin-button">Retake Photo</button>
                    </>
                ) : (
                    <button onClick={capture}>Capture Photo</button>
                )}
            </div>
        </div>
    );
};

// --- MAIN PARTICIPANT VIEW COMPONENT ---
const ParticipantView = ({ teamData }) => {
    const [isVerified, setIsVerified] = useState(teamData.selfie?.isVerified || false);

    useEffect(() => {
        socket.on(`selfieApproved_${teamData.teamCode}`, () => {
            setIsVerified(true);
        });
        return () => {
            socket.off(`selfieApproved_${teamData.teamCode}`);
        };
    }, [teamData.teamCode]);

    if (isVerified) {
        return <GameScreen teamData={teamData} />;
    } else {
        return <SelfieScreen teamData={teamData} />;
    }
};

export default ParticipantView;
