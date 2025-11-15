package com.surgealert.service;

import com.surgealert.entity.Resident;
import com.surgealert.repository.ResidentRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ResidentService {
    private final ResidentRepository residentRepository;

    public ResidentService(ResidentRepository residentRepository) {
        this.residentRepository = residentRepository;
    }

    public Resident registerResident(String phoneNumber) {
        if (residentRepository.existsByPhoneNumber(phoneNumber)) {
            throw new RuntimeException("Phone number already registered");
        }
        Resident resident = new Resident();
        resident.setPhoneNumber(phoneNumber);
        return residentRepository.save(resident);
    }

    public void unregisterResident(String phoneNumber) {
        Resident resident = residentRepository.findByPhoneNumber(phoneNumber)
                .orElseThrow(() -> new RuntimeException("Phone number not found"));
        resident.setIsActive(false);
        residentRepository.save(resident);
    }

    public List<String> getAllActivePhoneNumbers() {
        return residentRepository.findByIsActiveTrue().stream()
                .map(Resident::getPhoneNumber)
                .collect(Collectors.toList());
    }

    public List<Resident> getAllActiveResidents() {
        return residentRepository.findByIsActiveTrue();
    }
}