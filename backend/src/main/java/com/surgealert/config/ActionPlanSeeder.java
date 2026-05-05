package com.surgealert.config;

import com.surgealert.entity.ActionPlan;
import com.surgealert.repository.ActionPlanRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
public class ActionPlanSeeder implements CommandLineRunner {

    private final ActionPlanRepository repository;

    public ActionPlanSeeder(ActionPlanRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(String... args) throws Exception {
        // Only run if the table is empty
        if (repository.count() == 0) {
            
            // --- GREEN ---
            ActionPlan green = new ActionPlan();
            green.setAlertLevel("GREEN");
            green.setTitleEn("LEVEL 1 GREEN: BE AWARE & PREPARE");
            green.setTitleTl("LEVEL 1 GREEN: MAGING HANDA AT ALERTO");
            green.setShortDescriptionEn("The river is safe. There is no immediate flood risk.");
            green.setShortDescriptionTl("Ligtas ang ilog. Walang direktang panganib ng baha.");
            green.setActionsEn(List.of(
                "KNOW YOUR PLAN: Review your family's evacuation route and check your emergency \"Go Bag.\"",
                "STAY INFORMED: Monitor official weather forecasts."
            ));
            green.setActionsTl(List.of(
                "BALIKAN ANG PLANO: Tingnan muli ang inyong evacuation route at siguraduhing kumpleto ang laman ng inyong \"Go Bag.\"",
                "ANTABAYANAN ANG BALITA: Subaybayan ang mga ulat ng panahon mula sa mga opisyal na ahensya."
            ));
            repository.save(green);

            // --- YELLOW ---
            ActionPlan yellow = new ActionPlan();
            yellow.setAlertLevel("YELLOW");
            yellow.setTitleEn("⚠️ LEVEL 2 YELLOW: GET READY");
            yellow.setTitleTl("⚠️ LEVEL 2 YELLOW: HUMANDA");
            yellow.setShortDescriptionEn("The river is rising. Flooding is possible, especially in low-lying areas.");
            yellow.setShortDescriptionTl("Tumataas ang tubig sa ilog. Posible ang pagbaha, lalo na sa mababang lugar.");
            yellow.setActionsEn(List.of(
                "LISTEN: Pay close attention to official announcements.",
                "CHARGE: Keep phones, power banks, and flashlights fully charged.",
                "SECURE YOUR HOME: Move valuables and documents to higher ground."
            ));
            yellow.setActionsTl(List.of(
                "MAKINIG SA ANUNSYO: Maging alerto sa mga anunsyo mula sa inyong barangay o DRRMO.",
                "I-CHARGE ANG MGA GAMIT: Siguraduhing full-charge ang mga cellphone, power bank, at flashlight.",
                "I-AKYAT ANG GAMIT: Ilipat ang mahahalagang kagamitan at dokumento sa mas mataas at ligtas na lugar."
            ));
            repository.save(yellow);

            // --- ORANGE ---
            ActionPlan orange = new ActionPlan();
            orange.setAlertLevel("ORANGE");
            orange.setTitleEn("🟠 LEVEL 3 ORANGE: PREPARE TO EVACUATE");
            orange.setTitleTl("🟠 LEVEL 3 ORANGE: MAGHANDA PARA LUMIKAS");
            orange.setShortDescriptionEn("The situation is dangerous. Flooding is imminent or already starting in high-risk areas.");
            orange.setShortDescriptionTl("Delikado na ang sitwasyon. Malapit nang bumaha o nagsimula na ang pagbaha sa mga high-risk na lugar.");
            orange.setActionsEn(List.of(
                "EVACUATE IF ADVISED: If you are in a high-risk area, move to a safe place now.",
                "BE READY TO LEAVE: Grab your \"Go Bag.\" Help neighbors who may need assistance.",
                "PROTECT YOUR HOME: Turn off electricity and water only if it is safe to do so before leaving."
            ));
            orange.setActionsTl(List.of(
                "SIMULAN NANG LUMIKAS: Kung kayo ay nasa high-risk na lugar, umpisahan na ang paglikas sa ligtas na lugar.",
                "IHANDA NA ANG \"GO BAG\": Kunin na ang inyong \"Go Bag.\" Tulungan ang mga kapitbahay na nangangailangan.",
                "ISARADO ANG BAHAY: Patayin ang kuryente at isara ang linya ng tubig kung ligtas gawin bago umalis."
            ));
            repository.save(orange);

            // --- RED ---
            ActionPlan red = new ActionPlan();
            red.setAlertLevel("RED");
            red.setTitleEn("🚨 LEVEL 4 RED: HIGH FLOOD RISK");
            red.setTitleTl("🚨 LEVEL 4 RED: MATAAS NA RISGO NG BAHA");
            red.setShortDescriptionEn("The river is at a dangerous level. Minor flooding may be occurring.");
            red.setShortDescriptionTl("Nasa mapanganib na antas na ang ilog. Maaaring mayroon nang bahagyang pagbaha.");
            red.setActionsEn(List.of(
                "PREPARE TO LEAVE: Put your Go Bag by the door.",
                "STAY ALERT: Monitor the water level closely. Move to high ground if you feel unsafe.",
                "SECURE: Ensure all valuables are high up."
            ));
            red.setActionsTl(List.of(
                "MAGHANDA SA PAGLIKAS: Ilagay ang Go Bag sa malapit sa pinto.",
                "MANATILING ALERTO: Bantayan ang antas ng tubig. Lumikas kung sa tingin niyo ay hindi na ligtas.",
                "SIGURADUHIN: Ilagay sa mataas na lugar ang mga mahahalagang gamit."
            ));
            repository.save(red);

            // --- CRITICAL ---
            ActionPlan critical = new ActionPlan();
            critical.setAlertLevel("CRITICAL");
            critical.setTitleEn("☢️ LEVEL 5 CRITICAL: MANDATORY EVACUATION");
            critical.setTitleTl("☢️ LEVEL 5 CRITICAL: SAPILITANG PAGLIKAS");
            critical.setShortDescriptionEn("URGENT: The river is overflowing. Catastrophic flooding is occurring.");
            critical.setShortDescriptionTl("APURAHAN: Umaapaw na ang ilog. Nagaganap na ang malubhang pagbaha.");
            critical.setActionsEn(List.of(
                "EVACUATE IMMEDIATELY: Leave your home now for your safety.",
                "GO TO EVACUATION CENTER: Follow emergency routes to the nearest designated safe zone.",
                "DO NOT DELAY: Life-threatening situation. Every second counts."
            ));
            critical.setActionsTl(List.of(
                "LUMIKAS AGAD: Umalis na sa bahay ngayon para sa inyong kaligtasan.",
                "PUMUNTA SA EVACUATION CENTER: Sundin ang mga emergency route patungo sa ligtas na lugar.",
                "HUWAG MAG-ATUBILI: Panganib sa buhay. Mahalaga ang bawat segundo."
            ));
            repository.save(critical);

            System.out.println("SUCCESS: Action Plans have been inserted into the database.");
        }
    }
}