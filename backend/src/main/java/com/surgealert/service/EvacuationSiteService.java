package com.surgealert.service;

import com.surgealert.dto.EvacuationSiteDTO;
import com.surgealert.entity.EvacuationSite;
import com.surgealert.repository.EvacuationSiteRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class EvacuationSiteService {
    private final EvacuationSiteRepository evacuationSiteRepository;

    public EvacuationSiteService(EvacuationSiteRepository evacuationSiteRepository) {
        this.evacuationSiteRepository = evacuationSiteRepository;
    }

    public List<EvacuationSiteDTO> getAllActiveSites() {
        return evacuationSiteRepository.findByIsActiveTrue().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public EvacuationSite createSite(EvacuationSite site) {
        return evacuationSiteRepository.save(site);
    }

    private EvacuationSiteDTO convertToDTO(EvacuationSite site) {
        EvacuationSiteDTO dto = new EvacuationSiteDTO();
        dto.setId(site.getId());
        dto.setName(site.getName());
        dto.setLatitude(site.getLatitude());
        dto.setLongitude(site.getLongitude());
        dto.setAddress(site.getAddress());
        dto.setCapacity(site.getCapacity());
        return dto;
    }
}